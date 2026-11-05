# FieldReports

A React Native CLI and TypeScript app for field inspectors who need to submit photo reports over weak or unavailable internet connections. Reports and their photos are saved on the device before upload, so submitted work can wait in a persistent queue until connectivity returns.

## Main flow

1. Select **Create Report** and enter a short description (up to 500 characters).
2. Capture photos with the **camera**, choose photos from the **gallery**, or combine both. Submission requires a non-blank description and **1–5 photos**.
3. Choose **Save draft** to keep the report locally and continue editing or submit it later. Drafts may be incomplete and are never uploaded automatically.
4. Choose **Submit report** to save the report and its photos durably, then add it to the upload queue. When online, upload starts immediately; when offline, the report waits locally.
5. Eligible queued reports are sent automatically when connectivity returns while the app is active. After an app restart, saved work is recovered and eligible uploads resume when online.
6. View pending work and failures in **Reports → Local**. View reports fetched from the backend in **Reports → Reports**.

“Saved locally” means the work is stored on this device. A report is treated as uploaded only after the server returns a matching confirmation. Confirmed reports and their local photo copies are then removed from the device; use the server Reports tab to review them.

## Home screen statistics: local data only

**There is no dashboard/statistics API integrated for the Home screen. All Home statistics and recent activity are calculated from reports currently stored on this device. They are not server totals or lifetime submission counts.**

| Statistic | Source |
| --- | --- |
| Drafts | Local reports in the `draft` state |
| Photos | Total attached photos across all locally stored reports |
| Failed | Local reports in the `failed` state |
| Total | All reports currently stored locally |
| Pending | Local reports in `queued` or `retry_wait` |
| Uploading | Local reports in `uploading` |

Because server-confirmed reports are removed locally, **Total** and **Photos** can decrease after successful uploads. Reports created on other devices are not included. The server Reports tab separately calls `GET /api/reports`; it does not substitute local records for server results.

## Run the app

### Requirements

- Node.js **22.11.0 or newer** and npm.
- Android Studio, an Android SDK, a compatible JDK, and an emulator or USB-connected Android device with debugging enabled.
- The checked-in Android configuration uses compile SDK **37**, Build Tools **37.0.0**, target SDK **36**, minimum SDK **24**, and NDK **27.1.12297006**. Install the corresponding components required by Gradle.
- For iOS: macOS, Xcode, Ruby/Bundler, and CocoaPods.

The project uses React Native **0.88.1**, React **19.3.0**, and native modules; it runs through the React Native CLI.

### Android

From the repository root:

```sh
npm ci
npm start
```

In a second terminal, with an emulator running or a device connected:

```sh
npm run android
```

To build a debug APK directly:

```sh
cd android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

### iOS (optional)

```sh
bundle install
cd ios
bundle exec pod install
cd ..
npm run ios
```

Run Metro separately with `npm start`. iOS native builds and background delivery should be validated on the target device; the scheduling implementation currently configures background fetch only on Android.

## Backend setup and API contract

The mobile app defaults to this backend URL in [`src/config/env.ts`](src/config/env.ts):

```text
https://backend-five-omega-74.vercel.app
```

No backend source, deployment configuration, or backend startup script is included in this repository. Use the configured deployment if available. To stand up an independent backend, deploy a separate service implementing the contract below, with persistent report/photo storage and server-side idempotency, then point the app at its HTTPS URL. The backend's own repository and provisioning instructions are needed to reproduce that deployment.

For a different backend, change `DEFAULT_API_BASE_URL` in `src/config/env.ts` and reload/rebuild the app. The configuration module also exposes `setApiBaseUrl(url)` for a session-only override; there is no backend URL editor in Settings. `API_BASE_URL` is read from `process.env` only if the bundler/environment supplies it; this project does not include a `.env` loader. Use HTTPS: the reports API client rejects plain HTTP URLs even though the configuration validator and upload transport accept them.

### Endpoints used by the client

| Method | Path | Expected behavior |
| --- | --- | --- |
| POST | `/api/reports` | Receive a multipart report; return `201` for creation or `200` for an idempotent replay, with a JSON `clientReportId` matching the submitted key |
| GET | `/api/reports` | Return `{ "count": number, "reports": [...] }` |
| GET | `/api/reports/:id` | Return an individual report matching the report structure below; supported by the API service |
| DELETE | `/api/reports/:id` | Confirm deletion with `{ "success": true, "id": "<requested-id>" }` |

The upload request uses `multipart/form-data` with:

- `clientReportId`: a stable UUID reused for every attempt of the same report.
- `description`: the report text.
- `images`: 1–5 repeated file parts, each no larger than **5,242,880 bytes** (5 MiB, displayed as “5 MB” in the app).

A server report has this structure:

```json
{
  "id": "server-report-id",
  "clientReportId": "client-report-uuid",
  "description": "Inspection notes",
  "images": [
    {
      "id": "image-id",
      "filename": "photo.jpg",
      "originalName": "photo.jpg",
      "size": 245000,
      "mimetype": "image/jpeg",
      "url": "https://your-backend.example/photos/photo.jpg"
    }
  ],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

The backend must enforce uniqueness of `clientReportId` and return the existing report on a repeated submission. This is necessary when the server saves a report but its response is lost: **the client reuses the same key, but preventing duplicate server records requires backend support**. A `200`/`201` response without a matching JSON confirmation is not accepted as successful.

## Persistence, images, and delivery decisions

- **SQLite for durable state:** report metadata, image references, stable identifiers, attempts, and retry times are persisted with OP-SQLite. Transactions, WAL mode, full synchronous writes, and schema versioning support recovery rather than relying on in-memory UI state.
- **Files for image bytes:** processed photos are copied into the app's persistent `DocumentDir/report-images` directory before saved metadata is committed. SQLite stores references rather than Base64 payloads. Cleanup removes unreferenced files after saves, resets, and startup.
- **Process large originals:** camera/gallery photos are converted to JPEG using native image resizing. Processing tries maximum edges of 1600, 1280, 1024, and 800 pixels at progressively lower quality (88, 78, 68, 58), stopping when the actual file fits the cap. Large original size alone is not a rejection reason. An image that still exceeds the cap after processing produces an error.
- **Verify before sending:** image existence, actual file size, and consistency with saved metadata are checked before upload. Empty, missing, changed, or oversized files are not sent.
- **One upload worker:** reports are processed sequentially in queue order to avoid competing uploads over a weak connection. Duplicate worker invocations share the active run.
- **Recover interrupted work:** records left in `uploading` after termination move back to a retry state on launch, preserving their report identity and photo references.
- **Separate UI from delivery:** `UploadCoordinator` accepts a repository and transport and can be exercised without rendering a screen. React screens consume service state rather than owning the upload loop.

### States and retry policy

```text
draft → queued → uploading → uploaded → local cleanup
                    ↓
                retry_wait → uploading
                    ↓
                  failed → manual retry → queued
```

- Network errors, timeouts, HTTP `429`, and HTTP `5xx` are retryable.
- Automatic retry delay uses exponential backoff with jitter: a 2-second initial ceiling, capped at 5 minutes. A longer valid `Retry-After` value is respected.
- After **8 failed attempts**, the report needs manual retry. Other HTTP errors, local validation failures, unknown failures, and invalid confirmations also require attention rather than retrying indefinitely.
- Manual retry resets the attempt counter and preserves the same idempotency key.
- The upload coordinator has a **120-second timeout** per attempt. Report-list API requests have a **30-second timeout**.
- Connectivity detection does not exclude 2G connections. Foreground retries run when due; connectivity changes and returning to the foreground trigger another queue pass.

## Background behavior and practical limits

Android background fetch is configured with a minimum interval of 15 minutes, `stopOnTerminate: true`, `startOnBoot: false`, and no headless execution. Scheduling is controlled by the OS and does not guarantee an upload every 15 minutes. Moving to the background suspends the foreground worker; an available background-fetch callback can run another pass.

A force-quit does not remove saved queue data, but uploads cannot be promised while the app is terminated or force-stopped. Reopen the app to recover and resume. iOS background upload scheduling is not configured here.

Uploads send the whole report as one multipart request. There is no chunked or byte-range resume: an interrupted attempt resends the report using its existing key. On a sufficiently slow 2G connection, a large multipart request may repeatedly exceed the 120-second limit and eventually require manual retry. Sustained delivery under that condition remains a limitation to validate and improve.

## Make it fail and verify recovery

### Device scenario

1. Enable airplane mode and create **three submitted reports**, including one with five large camera photos. Use **Submit report** so they enter the queue; drafts deliberately remain drafts.
2. Confirm they appear in **Reports → Local**, then force-quit and reopen the app while still offline. The submitted reports and photos should remain.
3. Restore connectivity through a throttled connection. Keep the app active and interrupt connectivity twice during upload.
4. Watch pending/uploading/retry states. Once the server confirms each report, refresh **Reports → Reports** and verify three server records with distinct `clientReportId` values and all expected images.
5. Verify the received image files are each within the size cap. Home counts should fall as confirmed local copies are removed.

Use an emulator's cellular throttling controls or a network proxy to simulate slow links and dropped connections. Also test blank descriptions, zero photos, a sixth photo, large originals, and denied camera/photo access followed by granting access from device Settings.

### Controlled server failures

The app has no built-in server fault switch. Point a test build at an HTTPS test backend or reverse proxy implementing the same contract, then configure the following responses for `POST /api/reports`:

| Injected fault | Expected client behavior |
| --- | --- |
| Drop the connection during upload | Keep local work; retry recognized network failures |
| Save the report, then drop the response | Retry with the same key; an idempotent backend returns the existing report |
| Return `429` with `Retry-After: 10` | Wait at least 10 seconds before another eligible attempt |
| Return `500` or `503` | Persist a retry time and back off |
| Leave the request unanswered for over 120 seconds | Abort the attempt and persist retry state |
| Return `400` or `413` | Mark failed for attention rather than auto-retrying |
| Return `201` with a missing or different `clientReportId` | Reject the confirmation and retain local work as failed |
| Keep returning retryable failures | Require manual retry after eight failed attempts |

Run fault injection against a separate test service. The shipped backend's fault controls and deployment availability are not established by this mobile repository.

## Reset and deletion scope

**Settings → Clear local data** asks for confirmation, suspends the upload worker, deletes local report records (including drafts, queued work, and failures), and removes their app-managed photo files. It does not delete server reports or original camera/gallery photos. Unsent local work is permanently lost after this action. Cancelling an in-flight request cannot undo a report the server has already accepted.

**Settings → Delete all server reports** is a separate, confirmed online action. It fetches the complete server list, deletes listed reports individually, and fetches again to check that the server list is empty. It refuses to start if the returned count does not match the list length. This is not an atomic bulk operation: partial deletions are reported if a request fails. Local drafts and pending work remain and may upload afterward. Removal of remote photo bytes depends on the backend's delete implementation.

## Project structure

```text
src/
  config/env.ts           Backend URL and timeout configuration
  database/repository.ts SQLite schema, transactions, queue state, recovery
  services/
    api/                 Server report requests and response validation
    image/storage.ts     Durable photo storage and verification
    upload/              Upload coordinator, retries, multipart transport
    reports.ts           Save, retry, cleanup, and local reset operations
    runtime.ts           Native adapters, connectivity, background scheduling
  screens/               Home, composer, drafts, reports, settings, splash
  navigation/            Navigation and session types
  components/            Shared UI and report status components
__tests__/               API, transport, persistence, validation, UI tests
```

## Checks

```sh
npm test -- --runInBand
npm run lint
npx tsc --noEmit
```

The existing tests cover persistence and recovery, file-copy/transaction failures, queue ordering, stable retry identity, retry timing and exhaustion, stalled transports, reset, API parsing, HTTP transport behavior, and report validation. They exercise delivery logic without rendering a screen. Automated tests do not replace a real Android build or device testing with large photos, dropped connections, and OS background restrictions.

## Known omissions and another day of work

Deliberately outside the core scope: login, push notifications, comments, maps, video, and editing reports after upload. This repository also does not include backend infrastructure, dashboard statistics endpoints, a built-in fault-injection backend, or a bundled demo recording.

With another day, priorities would be:

1. Add resumable/per-image delivery and tune timeouts using measured 2G behavior, coordinating the protocol with the backend.
2. Exercise the complete device scenario repeatedly, including response loss after server commit, and verify backend idempotency and image integrity.
3. Validate Android background scheduling across device restrictions and implement/test the required iOS background setup if needed.
4. Package reproducible backend deployment and fault-injection instructions alongside a 2–3 minute airplane-mode-to-uploaded screen recording.
5. Add a dashboard API if server-wide statistics are required, retaining clear labels for device-only work.
