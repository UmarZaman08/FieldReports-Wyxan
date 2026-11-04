# FieldReports — React Native Technical Assessment

## 1. Project overview

Build a professional, production-minded React Native mobile application for field inspectors to create photo reports and reliably deliver them to a backend API, including when connectivity is weak or unavailable.

The application is being developed in phases. The immediate development focus is the mobile application: UI/UX, navigation, local persistence, camera/gallery handling, image processing, upload orchestration, status visibility, and quality. Backend implementation is explicitly out of scope. The app should integrate with a separately provided backend through a clean API layer.

### Existing project setup

- Project name: `FieldReports`
- React Native CLI (bare workflow), not Expo managed
- React Native: `0.88.1`
- React: `19.3.0`
- TypeScript
- Node requirement: `>=22.11.0`
- Android is mandatory; iOS is welcome if practical.
- Existing source folders:
  - `src/assets`
  - `src/components`
  - `src/constants`
  - `src/navigation`
  - `src/screens`
  - `src/services`
  - `src/store`
  - `src/utils`
- Existing screen folders: `Draft`, `Home`, `Login`, `Reports`, `Settings`, `Splash`
- Do not recreate the project or replace its existing setup without a demonstrated technical reason.
- Inspect the actual repository before editing. Preserve useful existing code and conventions.

## 2. Installed dependencies

Current `package.json` dependencies:

```json
{
  "@bam.tech/react-native-image-resizer": "^3.0.11",
  "@op-engineering/op-sqlite": "^19.0.3",
  "@react-native-community/netinfo": "^12.0.1",
  "@react-native/new-app-screen": "0.88.1",
  "@react-navigation/elements": "^2.9.45",
  "@react-navigation/native": "^7.5.1",
  "@react-navigation/native-stack": "^7.21.0",
  "axios": "^1.21.0",
  "dayjs": "^1.11.23",
  "react": "19.3.0",
  "react-native": "0.88.1",
  "react-native-background-fetch": "^4.4.2",
  "react-native-blob-util": "^0.25.1",
  "react-native-gesture-handler": "^3.4.0",
  "react-native-get-random-values": "^2.1.0",
  "react-native-image-picker": "^8.3.0",
  "react-native-safe-area-context": "^5.11.1",
  "react-native-screens": "^4.30.1",
  "react-native-svg": "^15.16.0",
  "uuid": "^14.0.3",
  "zustand": "^5.0.16"
}
```

Dev dependencies include TypeScript, React Native CLI tooling, Jest, React Native Testing Library, ESLint, Prettier, and React Native type/config packages.

### Dependency rules

- Prefer already installed dependencies.
- Do not add packages just for convenience or duplicate existing functionality.
- Before adding a dependency, explain why it is needed, check compatibility with RN 0.88.1 / React 19.3.0 / New Architecture as applicable, and ask before installing.
- Do not assume a library works with the current RN version without checking its installed package/API and native setup.
- `react-native-background-fetch` is not a guaranteed continuous upload engine. Do not promise execution at an exact interval or execution after Android force-stop.
- Background scheduling is a later implementation concern. Persist work first; schedule/recover it when the app starts and when suitable OS/network events occur.
- Do not install or configure a backend SDK unless a real backend choice is made.

## 3. Assessment requirements (source of truth)

### Main user flow

A field inspector must be able to:

1. Create a report with a non-blank short description.
2. Attach between 1 and 5 photos.
3. Capture photos with the camera or select them from the gallery.
4. Save work locally while offline.
5. Have pending reports uploaded when connectivity permits.
6. See clear report/upload states.
7. Review reports fetched from the backend (not merely the local store).
8. Deliberately reset local application data with clearly communicated consequences.

### Hard requirements

- 1–5 images per report. Both limits must be enforced.
- Every image sent to the destination must be **strictly below or equal to 5 MB** (use 5 * 1024 * 1024 bytes as the app-side maximum unless the backend contract defines a stricter limit).
- Large original photos, including ~18 MB camera photos, are valid input. Process them; do not reject merely because the original is large.
- Description is required and must not be whitespace-only.
- 2G/slow network is a normal operating condition, not automatically an outage.
- A report must survive app force-quit/relaunch.
- A network interruption or lost response must not lose a report.
- A retry must not create a duplicate server report.
- UI must distinguish “saved locally” from “uploaded successfully”.
- Upload logic must be exercisable without rendering a screen.
- No login, push notifications, comments, maps, video, or editing an already-uploaded report are required by the assessment. Do not spend time implementing these.
- Android build/run is mandatory; iOS is optional.

### Assessment scoring

- Delivery guarantees: 30%
- UI/UX judgement: 25%
- Image handling: 20%
- Architecture: 15%
- Communication (README, commits, demo, trade-offs): 10%

## 4. Product and UX direction

Create a polished, calm, professional field-operations interface. It should feel like a real mobile productivity tool rather than a generic AI-generated template.

### Visual direction

- Clear hierarchy, restrained colors, consistent spacing, readable typography.
- Use a light neutral background, white/near-white surfaces, dark readable text, and one restrained primary accent.
- Use status colors consistently:
  - Draft / saved locally: neutral or amber
  - Uploading: blue
  - Uploaded: green
  - Failed / action required: red
  - Offline: neutral/amber with clear text
- Avoid excessive gradients, decorative cards, random icons, unnecessary animations, and oversized empty hero areas.
- Use consistent design tokens for colors, spacing, radius, typography, and shadows.
- Respect safe areas, keyboard behavior, platform conventions, and accessible touch targets.
- Support small phones and larger devices; avoid fixed dimensions where responsive layout is appropriate.
- Do not invent a brand logo. Use a simple typographic identity until a real asset is supplied.
- Avoid placeholder/sample report data in production screens. If demo data is needed for development, isolate it behind an explicit development-only mechanism.

### Core screens

1. **Splash**
   - Brief branded launch experience.
   - Avoid artificial long delays.
   - Initialize only essential app bootstrap work.
   - Route to the main app when ready.
   - Handle initialization errors gracefully; do not leave the user on an endless splash.

2. **Home / Dashboard**
   - At-a-glance summary:
     - Draft reports
     - Pending / queued reports
     - Uploading reports
     - Successfully uploaded reports
     - Failed reports
   - Show network state and upload activity in plain language.
   - Primary action: Create report.
   - Show a compact recent activity/reports section with useful status labels.
   - Statistics must derive from a single reliable source of app data, not manually maintained counters that drift.

3. **Create Report / Draft**
   - Description input with required validation.
   - Add photos from camera or gallery.
   - Show selected image thumbnails, count (e.g. 3/5), remove action, and processing state.
   - Enforce 1–5 photos before submission.
   - Explain image processing or size failures clearly.
   - Save locally without waiting for network.
   - Protect unsaved work when navigating away; make the save/discard decision explicit if necessary.

4. **Drafts**
   - List locally saved reports that have not been uploaded.
   - Show saved time, photo count, and status.
   - Allow opening a draft to continue editing before it is submitted to the upload queue, if this remains within the assessment scope.
   - Never imply a draft is already on the server.

5. **Upload Queue / Activity**
   - Make queued, uploading, retrying, failed, and uploaded states understandable.
   - Show progress only when it is real and measurable. Do not fabricate percentage progress.
   - Provide a manual retry action for eligible failures.
   - Explain when a report is waiting for network.
   - Avoid blocking the entire app during upload.

6. **Reports**
   - Fetch server reports through the API service.
   - Include loading, empty, refresh, offline/error, and retry states.
   - Keep server-fetched reports conceptually separate from local drafts/queue items.
   - Do not silently present local records as server records.
   - A locally uploaded report may be shown as confirmed only after a successful/verified server response or a subsequent server fetch according to the API contract.

7. **Settings**
   - Show app version if readily available.
   - Provide a deliberate reset action with a confirmation explaining exactly what will be deleted and what cannot be undone.
   - Do not implement unrelated settings.

### Navigation

Use React Navigation native stack (already installed). Keep navigation types strongly typed. Choose a simple, predictable navigation structure. Do not add tabs/drawers unless they materially improve the experience. A bottom tab navigator may be considered for the main destinations if it improves discoverability, but do not add another navigation package.

## 5. Data and state principles

Backend database development is out of scope, but local persistence is not optional because the assessment requires offline durability.

### Local persistence

Use the already installed `@op-engineering/op-sqlite` for durable local metadata and queue state when implementing persistence.

- Store report metadata, state, retry information, timestamps, idempotency key, and image file references in SQLite.
- Store actual image bytes as files in an app-controlled persistent directory, not Base64 in SQLite or Zustand.
- Copy processed images from temporary picker/cache locations into app-owned persistent storage before treating a report as safely saved.
- Keep file lifecycle and database lifecycle coordinated. Avoid orphaned files and missing-file records.
- Use database transactions for related metadata/queue changes.
- Add schema versioning/migrations.
- Do not clear local data on ordinary app startup or app upgrade.

### Suggested report lifecycle

Use explicit, documented states. Suggested initial model (refine when implementing):

- `draft`: locally saved but not submitted to upload queue
- `queued`: submitted and waiting for upload
- `uploading`: upload currently in progress
- `retry_wait`: transient failure; eligible for retry later
- `failed`: permanent failure or retry policy exhausted; user action may be needed
- `uploaded`: server has confirmed successful creation

Do not overload one status field with unrelated concepts. If needed, model report lifecycle and per-image upload state separately.

### Idempotency and delivery

- Generate a stable UUID/idempotency key once when a report is created/submitted; never generate a new key for each retry.
- Send the same key on every retry, using the backend's agreed idempotency mechanism (header or request field).
- Client-side UUID alone does not guarantee no duplicates. The server must enforce idempotency/uniqueness. Document this integration requirement.
- Handle the ambiguous outcome where the server accepted the report but the response was lost. Retry with the same idempotency key and reconcile the server response.
- Do not mark a report uploaded merely because the request was started or bytes were sent.

### Retry policy

Classify errors rather than retrying every error:
- Network unavailable / connection reset / timeout: transient
- HTTP 5xx: generally transient
- HTTP 429: transient; respect `Retry-After` when available
- HTTP 4xx validation errors: generally permanent until the user fixes the data or API contract says otherwise
- Invalid/missing local image: permanent local failure requiring user attention

Use capped exponential backoff with jitter. Persist retry count and next eligible retry time. Avoid tight retry loops. Make retry policy independently testable.

## 6. Image pipeline

Use `react-native-image-picker` and `@bam.tech/react-native-image-resizer` already installed, after verifying their actual API and platform configuration.

Expected flow:

1. Request camera/library permission only when the user invokes the relevant action.
2. Handle denied, blocked, limited, cancelled, and unavailable outcomes distinctly.
3. Pick/capture an image.
4. Validate supported type and source file availability.
5. Resize/compress off the main UI interaction path where possible.
6. Check actual output file size in bytes.
7. If output exceeds 5 MB, retry with a lower quality/resolution strategy within sensible limits.
8. If it still cannot meet the cap without unacceptable degradation, explain the problem and do not enqueue it.
9. Copy final processed file into app-controlled persistent storage.
10. Persist metadata and local path.
11. Clean up temporary files safely.

Additional rules:
- Never trust a configured compression quality as proof the output is below 5 MB; measure the resulting file.
- Preserve useful visual detail and orientation.
- Do not freeze the UI while processing multiple large photos.
- Show per-image processing/error states.
- Avoid Base64 conversions.
- Do not delete a source file until the processed copy is verified and safely persisted.
- Handle interrupted processing and missing files on app restart.

## 7. Architecture and code quality

Use feature-oriented boundaries while keeping the repository understandable for an eight-hour assessment.

Suggested structure (adapt to existing project; do not move everything without a reason):

```text
src/
├── assets/
├── components/
│   ├── common/
│   ├── reports/
│   └── upload/
├── constants/
│   ├── app.ts
│   └── upload.ts
├── database/
│   ├── index.ts
│   ├── schema.ts
│   ├── migrations/
│   └── repositories/
├── navigation/
├── screens/
│   ├── Splash/
│   ├── Home/
│   ├── Draft/
│   ├── Reports/
│   └── Settings/
├── services/
│   ├── api/
│   ├── image/
│   ├── network/
│   └── upload/
├── store/
├── types/
└── utils/
```

### Separation of responsibilities

- Screens: compose UI and connect user actions to application operations.
- Components: reusable presentation; avoid business logic hidden inside generic components.
- Services/use-cases: application workflows such as create report, process image, enqueue, upload, retry, and fetch server reports.
- Repositories: persistence boundary; screens should not write SQL directly.
- API client: central Axios configuration, timeout/error normalization, and endpoint functions.
- Store (Zustand): transient UI state and derived view state where appropriate. SQLite remains the durable source of truth for drafts and queue.
- Types: shared domain/API/navigation types.
- Utilities: small pure helpers only; do not turn `utils` into a dumping ground.

### TypeScript standards

- Use strict, meaningful types. Avoid `any`; if unavoidable, isolate and explain it.
- Type navigation params, API request/response models, database rows, image assets, and upload states.
- Validate untrusted API responses at the boundary where practical.
- Use discriminated unions for complex result/error states when useful.
- Avoid excessive type abstractions and generic frameworks for a small app.
- Do not use TypeScript casts to silence errors without understanding them.

### React Native best practices

- Use function components and hooks.
- Keep components focused and reasonably small.
- Extract reusable logic into custom hooks only when it improves separation/reuse.
- Keep upload orchestration outside screens and React components.
- Avoid unnecessary state duplication and derived state.
- Use stable callbacks/memoization when there is a demonstrated render or prop-stability benefit; do not wrap every function in `useCallback` or every component in `memo` blindly.
- Use `FlatList`/`SectionList` for potentially growing lists, stable keys, and appropriate list configuration.
- Avoid nested scroll views with same-axis scrolling.
- Lazy-load/defer non-critical screens or expensive work where React Navigation and the current setup support it cleanly.
- Avoid importing large modules or doing expensive work during render.
- Avoid large synchronous transformations on the JS thread.
- Clean up subscriptions, event listeners, and timers.
- Handle app foreground/background transitions where needed.
- Respect keyboard, safe areas, Android back behavior, and accessibility labels.
- Use design tokens rather than repeated magic values.
- Do not use `Dimensions` as a one-time fixed layout assumption; prefer flexible layout and responsive utilities only where required.
- No console logging of sensitive content or image data. Use a small development-safe logger if needed.
- Do not add artificial loading delays.
- Keep error and empty states intentional and actionable.

### Testing

- Add unit tests for pure validation, image-size policy, retry classification/backoff, status transitions, and idempotency-key stability where feasible.
- Keep upload orchestration callable without rendering UI.
- Add focused component tests for critical forms/status UI where time permits.
- Do not claim a test passed unless it was run.
- Run TypeScript checks, lint, tests, and Android build at relevant milestones; report actual results and blockers.

## 8. API integration boundary (backend is not being built here)

Create a backend-agnostic API layer, but do not invent final endpoints or response fields.

- Keep base URL and environment configuration out of UI components.
- Use typed API functions such as `createReport`, `getReports`, and optional `getReportById` only after an API contract is available.
- Keep multipart upload construction inside the API/service layer.
- Configure request timeout intentionally; normalize Axios/network errors into application-level error categories.
- Do not hardcode fake success responses in production code.
- If backend contract is not yet available, use a clearly named mock adapter or development fixture behind an interface. Make switching to real API straightforward.
- Document the exact API contract still needed: endpoint, method, multipart field names, auth requirements (if any), idempotency header/field, response shape, pagination, and error formats.
- Do not build login/auth because the assessment explicitly excludes it.

## 9. Statistics requirements

The dashboard should display useful operational counts:
- Draft
- Queued / pending
- Uploading
- Failed / action required
- Uploaded / successful

Rules:
- Counts must be derived from persisted report/queue records or a well-defined repository query.
- Avoid independently incrementing/decrementing counters in multiple screens.
- Define whether “Uploaded” means server-confirmed and document it.
- Do not count a draft as queued.
- Do not count a failed report as successful.
- Refresh/recompute counts after every relevant state transition and app recovery.
- If server reports are also shown, keep server totals separate from local queue totals unless the product definition explicitly combines them.

## 10. Reset semantics

Reset is destructive and must be deliberate.

Before implementing reset:
- Define exactly which local data is removed: drafts, pending queue items, processed local image files, cached server data, and preferences.
- Explain that reset cannot delete already uploaded server reports unless a separate backend delete API exists and is explicitly in scope.
- Require a confirmation step.
- Perform coordinated database/file cleanup safely.
- Do not leave queue records pointing to deleted files.
- Do not claim remote data has been reset when only local data was cleared.

## 11. Git workflow and phase discipline

This project must show real incremental Git history.

- Work in small, reviewable phases.
- Do not squash everything into one initial commit.
- Do not commit generated build artifacts, secrets, `.env` files, keystores, or local machine configuration.
- Do not push automatically.
- After each phase, provide:
  1. Files created/changed
  2. What was implemented
  3. Commands/tests actually run and their results
  4. Known gaps or risks
  5. Suggested commit message
- Wait for the developer to review and request/perform the commit or push.
- Never rewrite or discard existing user changes.
- Before editing, inspect `git status` and preserve uncommitted work.

Suggested commit messages:
1. `feat: add splash screen and app bootstrap`
2. `feat: build home dashboard and navigation`
3. `feat: add report composition and validation`
4. `feat: add camera gallery and image optimization`
5. `feat: persist report drafts locally`
6. `feat: add persistent upload queue and retry states`
7. `feat: integrate server reports API`
8. `feat: add dashboard statistics and reset settings`
9. `test: harden offline upload flows and polish app`

## 12. How Codex must work

The developer will provide one phase prompt at a time. Follow these rules:

1. Read this document first and treat it as the project brief.
2. Inspect the current repository, package scripts, TypeScript config, app entry point, existing components, and `git status` before changing code.
3. Implement only the scope of the current phase. Do not jump ahead or scaffold every future feature.
4. Reuse the existing project and dependencies.
5. Ask before installing dependencies or making broad native configuration changes.
6. Do not fabricate backend APIs, design assets, test results, or completed functionality.
7. Keep the code understandable to a React Native engineer with 3+ years of experience. Avoid tutorial-style over-commenting and AI-looking boilerplate.
8. Prefer clear naming, explicit types, simple abstractions, and maintainable code.
9. Do not leave dead code, unused imports, placeholder buttons, fake progress, or misleading UI.
10. At the end, summarize changes, validation performed, remaining issues, and a proposed commit message. Do not commit or push unless explicitly instructed.

---

# 13. Phase prompts

Use these prompts sequentially. Do not execute later phases early.

## Phase 01 — Splash screen and app bootstrap

```text
Read `PROJECT_SPEC.md` completely before making changes.

We are implementing Phase 01 only: Splash screen and minimal app bootstrap.

First inspect the existing repository, package.json, app entry point, TypeScript configuration, current navigation setup (if any), existing Splash screen files, and `git status`. Preserve all existing user changes. Do not recreate the project.

Requirements:
- Implement a polished, professional Splash screen for the FieldReports field-reporting app.
- Use a restrained, modern visual style: neutral background, strong readable typography, one primary accent, subtle brand mark made from existing primitives if no logo asset exists.
- The screen should communicate the product identity (Field Reports / Field operations) without unnecessary marketing copy.
- Respect safe areas and different screen sizes.
- Avoid artificial delays, heavy animations, remote assets, and unnecessary dependencies.
- Add only the minimal app bootstrap/navigation wiring needed to launch the Splash screen and transition into a simple temporary next-step placeholder or the existing Home screen if it already exists and is usable.
- Do not implement the Home dashboard, database, API, report composition, upload queue, or other future phases.
- If initialization is not needed yet, keep bootstrap intentionally small. Do not invent loading tasks.
- Ensure TypeScript types are meaningful and avoid `any`.
- Keep UI components and styles organized consistently with the existing project.
- Do not install dependencies or change native project configuration unless absolutely necessary; explain first if required.
- Check Android/iOS entry-point requirements already present in the project rather than blindly rewriting them.

Quality requirements:
- No unnecessary re-renders or state.
- No fixed layout assumptions that break on smaller devices.
- No dead code, placeholder interactions, or console noise.
- Follow existing lint/format conventions.

Before finishing, run the relevant available checks (at minimum TypeScript/lint if configured; report if scripts/config do not support them). Do not claim checks passed unless actually run.

At the end, report:
1. Files created/modified.
2. What the Splash and bootstrap do.
3. Commands run and actual results.
4. Any known issue or follow-up.
5. Suggested Git commit message.

Do not commit or push. Wait for my review before Phase 02.
```

## Phase 02 — Navigation and Home dashboard

```text
Read `PROJECT_SPEC.md`. Inspect the current implementation and git status. Implement Phase 02 only.

Build a clean, strongly typed navigation structure and a professional Home dashboard. The dashboard should establish the visual design system and show clearly labelled operational summary cards for Draft, Pending, Uploading, Failed, and Uploaded. Since real persistence/API work comes later, do not fabricate live counts or fake report activity. Use explicit empty/zero states or a clearly isolated development preview only if necessary.

Add a prominent Create Report entry point and sensible destinations/placeholders for Drafts, Reports, and Settings. Make every visible control functional; do not leave decorative buttons that do nothing. Keep navigation simple and use the installed React Navigation packages.

Do not implement database, image picker, upload logic, or backend calls. Extract reusable design tokens and common UI components only where they are actually used. Follow the specification's TypeScript, accessibility, performance, and responsive-layout rules.

Run relevant checks and report actual results. Do not commit or push. Summarize files, implementation, checks, gaps, and a suggested commit message.
```

## Phase 03 — Report composition and validation

```text
Read `PROJECT_SPEC.md`. Inspect current code and git status. Implement Phase 03 only.

Build the Create Report experience:
- Required short description with whitespace-only validation.
- Photo attachment section designed for a 1–5 image limit.
- Clear 0/5 through 5/5 count and validation messages.
- Camera and Gallery entry points can be wired to the existing picker only if the integration is in this phase's approved scope; otherwise keep the UI state honest and do not show fake success.
- Clear remove-image interaction for selected images.
- Sensible keyboard handling, safe areas, accessible touch targets, and unsaved-work protection.
- Design the screen to feel polished and native.

Do not implement actual image compression, persistent storage, or uploads unless explicitly required to make the phase work; those belong to later phases. Do not pretend a report is durably saved if it is only in component state. Keep business rules in testable functions, not buried in JSX. Add tests for description and photo-count validation if the current test setup supports them.

Run checks and report actual results. Do not commit or push.
```

## Phase 04 — Camera, gallery, and image optimization

```text
Read `PROJECT_SPEC.md`. Inspect current code, installed package APIs, native setup, and git status. Implement Phase 04 only.

Integrate the already installed `react-native-image-picker` and `@bam.tech/react-native-image-resizer` for camera/gallery selection and image processing.

Requirements:
- Request permissions only after user action.
- Handle cancel, denied, blocked, limited, and unavailable permission/result states.
- Enforce maximum 5 selected images.
- Handle large originals (including ~18 MB).
- Resize/compress and verify actual resulting file size in bytes against the 5 MB maximum.
- If still above the cap, retry with a controlled lower quality/resolution strategy; if it cannot meet the cap, show a clear actionable error.
- Preserve image orientation and acceptable visual quality.
- Show per-image processing state and prevent duplicate selection/actions while appropriate.
- Avoid Base64 and avoid blocking the UI thread with expensive work.
- Safely manage temporary files; do not claim an image is ready until the processed file is verified.
- Recheck permission state when the app returns from Settings if needed.

Verify actual installed APIs and current RN compatibility rather than guessing method signatures. Do not add dependencies or modify native configuration without explaining why first. Do not implement SQLite persistence or upload yet.

Add focused tests for the pure image-size/selection policy where practical. Run checks and report actual results. Do not commit or push.
```

## Phase 05 — Local draft persistence

```text
Read `PROJECT_SPEC.md`. Inspect current code, op-sqlite installed API/examples/types, image file handling, and git status. Implement Phase 05 only.

Add durable local persistence for report drafts using the already installed `@op-engineering/op-sqlite`.

Requirements:
- Define typed report/image models and a versioned SQLite schema.
- Add a repository boundary; screens must not execute SQL directly.
- Save description, timestamps, draft status, image metadata, and app-owned persistent image file paths.
- Copy processed images into a persistent app-controlled directory before marking the draft safely saved.
- Store file paths/metadata in SQLite, never image Base64.
- Use transactions for related database changes.
- Handle failures and clean up partially copied files/records safely.
- Restore drafts after force-quit/relaunch.
- Make draft list/detail state derive from repository data.
- Do not implement backend calls or actual upload queue yet.
- Do not silently delete user drafts during migration or startup.

Use the real installed op-sqlite API; do not invent APIs. Add repository/validation tests where possible. Run checks and report actual results. Do not commit or push.
```

## Phase 06 — Upload queue and retry states

```text
Read `PROJECT_SPEC.md`. Inspect current repositories, file paths, background/network packages, app lifecycle handling, and git status. Implement Phase 06 only.

Implement a UI-independent upload queue/orchestrator. It must be callable and testable without rendering React components.

Requirements:
- Persist queue state, stable idempotency key, retry count, next attempt time, and status.
- Reuse one idempotency key for every retry of the same report.
- Define and test explicit state transitions.
- Use NetInfo as a connectivity hint, not proof that the backend is reachable.
- Process reports sequentially initially to conserve bandwidth and simplify recovery.
- Handle timeout, connection reset, 5xx, 429/Retry-After, validation 4xx, missing local file, and unknown errors distinctly.
- Use capped exponential backoff with jitter and persist next retry time.
- Never mark uploaded before server confirmation.
- Recover stale `uploading` records on app startup and make them eligible for safe retry/reconciliation.
- Do not assume background-fetch guarantees execution after force-stop or at a fixed interval.
- Provide a scheduler abstraction so native background scheduling can be integrated without coupling the queue to UI.
- Avoid duplicate concurrent workers.
- Do not invent backend endpoint or response contracts. Use a typed API interface/mock adapter until the actual contract is supplied.
- UI must show honest statuses; no fabricated upload percentage.

Add tests for retry classification, backoff, idempotency-key stability, and state transitions. Run checks and report actual results. Do not commit or push.
```

## Phase 07 — Server Reports API

```text
Read `PROJECT_SPEC.md`. Inspect current API layer and any backend contract supplied in the repository or by me. Implement Phase 07 only.

Connect the Reports screen to a typed API service that fetches reports from the server. Do not use local draft records as a substitute for server-fetched reports.

Requirements:
- Centralized Axios client and environment-based base URL.
- Typed request/response models based on the real API contract.
- Loading, empty, refresh, offline, timeout, server-error, and retry states.
- Pagination only if supported by the actual contract.
- Normalize API errors at the service boundary.
- Keep server report data separate from local drafts and pending queue records.
- Do not invent endpoints, multipart field names, response fields, or authentication.
- If no API contract has been supplied, build only the API interface and a clearly isolated development mock adapter; state exactly what contract details are still needed.
- No login/auth implementation.

Run checks and report actual results. Do not commit or push.
```

## Phase 08 — Statistics, Settings, and reset

```text
Read `PROJECT_SPEC.md`. Inspect current repositories, queue state, dashboard, and git status. Implement Phase 08 only.

Complete operational dashboard statistics and Settings/reset behavior.

Statistics:
- Draft, queued/pending, uploading, retry-wait, failed, and uploaded counts.
- Derive counts from the repository/source of truth; do not maintain independent counters that drift.
- Define and document whether retry-wait is included in pending.
- Uploaded means server-confirmed only.
- Refresh counts after state transitions and startup recovery.
- Keep server-fetched report totals separate from local queue totals unless explicitly specified.

Reset:
- Define the local reset scope clearly.
- Show a destructive confirmation explaining exactly what will be deleted.
- Coordinate SQLite and local file cleanup safely.
- Do not imply that remote/server reports are deleted.
- Do not clear remote data without an explicitly supplied delete API and approval.
- Avoid leaving dangling image paths or queue records.

Run checks and report actual results. Do not commit or push.
```

## Phase 09 — Hardening, performance, and assessment readiness

```text
Read `PROJECT_SPEC.md`. Review the whole implementation and git status. Implement Phase 09 only: hardening and polish. Do not redesign working screens without a clear reason.

Audit and improve:
- Force-quit/relaunch recovery for drafts and pending uploads.
- Airplane mode and network transition behavior.
- Lost response / idempotent retry behavior (client-side assumptions clearly documented).
- Image size cap and file integrity.
- Permission denial then later grant from Settings.
- Sixth image, zero images, blank description.
- Stale upload recovery and concurrent worker protection.
- Honest status/error/empty/loading UI.
- Accessibility, keyboard, safe areas, small-screen layout.
- FlatList usage and render performance where relevant.
- Subscription cleanup, error handling, and logging.
- TypeScript strictness, lint, tests, Android build.
- README accuracy: setup, architecture, API contract assumptions, failure simulation approach, limitations, and what remains incomplete.

Do not claim server-side exactly-once delivery unless the backend enforces idempotency. Do not claim background execution after Android force-stop. Clearly document platform/OS constraints and any remaining gaps.

Run checks and report exact commands/results. Provide a concise assessment demo script. Do not commit or push.
```

## 14. Definition of done

The app is not complete merely because the screens look good. The minimum meaningful completion criteria are:

- [ ] App launches into a polished Splash and reaches the main app.
- [ ] Navigation and all visible actions work.
- [ ] A report requires a non-blank description and 1–5 images.
- [ ] Large photos are processed and every outgoing image is verified at or below 5 MB.
- [ ] Processed images are stored in persistent app storage.
- [ ] Drafts survive force-quit/relaunch.
- [ ] Queue state survives force-quit/relaunch.
- [ ] Upload logic is independent of UI.
- [ ] Retry behavior distinguishes transient and permanent failures.
- [ ] Stable idempotency key is reused for retries.
- [ ] Server reports are fetched through the API layer.
- [ ] Dashboard counts reflect real local states.
- [ ] Saved locally and uploaded are never conflated.
- [ ] Reset clearly explains its local-only scope.
- [ ] Android builds and runs.
- [ ] README, meaningful commit history, and short demo recording are prepared.

## 15. Important engineering honesty

The app can guarantee durable local storage only after the database transaction and persistent image-file copy have both succeeded. The client alone cannot guarantee that a server never stores duplicates: server-side idempotency is required. Android cannot run ordinary app background work while the user has force-stopped the app; recovery should occur when the app is launched again. Background scheduling is best-effort and OS-controlled.

Prioritize correctness, honest UI, and a complete narrow delivery path over adding unrelated features.
