import type { Report, TemporaryImage } from '../../types/report';
import {
  UploadError,
  type UploadConfirmation,
  type UploadTransport,
} from './coordinator';
import { getApiBaseUrl, ENV } from '../../config/env';
import { logApi, summarizeResponse } from '../api/logger';

export interface HttpTransportOptions {
  getBaseUrl?: () => string;
  timeoutMs?: number;
  fetcher?: (url: string, init: TransportRequestInit) => Promise<Response>;
}

interface TransportRequestInit extends Omit<RequestInit, 'body' | 'signal'> {
  body: FormData;
  signal: AbortSignal;
}
type NativeFetchInit = NonNullable<Parameters<typeof fetch>[1]>;

function getMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

/**
 * Standard HTTP multipart transport delivering reports to the backend API.
 * Uses the backend contract:
 * - Method: POST /api/reports
 * - Body: multipart/form-data
 *   - clientReportId: report.idempotencyKey (UUID)
 *   - description: report.description
 *   - images: 1-5 files
 * - Response 201 Created or 200 OK (idempotent duplicate response) -> confirmed
 */
export class HttpUploadTransport implements UploadTransport {
  private readonly getBaseUrl: () => string;
  private readonly timeoutMs: number;
  private readonly fetcher: (
    url: string,
    init: TransportRequestInit,
  ) => Promise<Response>;

  constructor(options: HttpTransportOptions = {}) {
    this.getBaseUrl = options.getBaseUrl ?? getApiBaseUrl;
    this.timeoutMs = options.timeoutMs ?? ENV.UPLOAD_TIMEOUT_MS;
    this.fetcher =
      options.fetcher ??
      ((url, init) => {
        if (typeof fetch === 'undefined') {
          throw new UploadError(
            'Fetch API is not available in the current runtime.',
            'local',
          );
        }
        const nativeInit: NativeFetchInit = {
          ...init,
          body: init.body as unknown as NativeFetchInit['body'],
          signal: init.signal as unknown as NativeFetchInit['signal'],
        };
        return fetch(url, nativeInit);
      });
  }

  async upload(
    report: Readonly<Report>,
    signal: AbortSignal,
  ): Promise<UploadConfirmation> {
    const baseUrl = this.getBaseUrl().replace(/\/+$/, '');
    const endpoint = `${baseUrl}/api/reports`;

    // Construct multipart form data
    const formData = new FormData();
    formData.append('clientReportId', report.idempotencyKey);
    formData.append('description', report.description);

    for (let i = 0; i < report.images.length; i++) {
      const img: TemporaryImage = report.images[i];
      const filename = img.name || `photo_${i + 1}.jpg`;
      const mime = getMimeType(filename);

      // React Native FormData file representation
      formData.append('images', {
        uri: img.uri,
        name: filename,
        type: mime,
      } as unknown as Blob);
    }

    logApi('POST /api/reports request', {
      method: 'POST',
      path: '/api/reports',
      payload: {
        clientReportId: report.idempotencyKey,
        descriptionLength: report.description.length,
        images: report.images.map(image => ({
          name: image.name,
          size: image.size,
          width: image.width,
          height: image.height,
        })),
      },
    });

    try {
      const response = await this.fetcher(endpoint, {
        method: 'POST',
        body: formData,
        signal,
        headers: {
          Accept: 'application/json',
        },
      });

      const retryAfter = response.headers?.get?.('Retry-After') || undefined;

      // HTTP 201: Report created
      // HTTP 200: Report already existed on server (Idempotent replay)
      if (response.status === 201 || response.status === 200) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new UploadError(
            'Server returned a success status but an unparseable response body.',
            'unknown',
            response.status,
          );
        }
        logApi('POST /api/reports response', {
          status: response.status,
          body: summarizeResponse(body),
        });

        // Verify that server acknowledged the report
        if (
          body &&
          typeof body === 'object' &&
          'clientReportId' in body &&
          body.clientReportId === report.idempotencyKey
        ) {
          return { confirmed: true };
        }

        throw new UploadError(
          'Server acknowledged request but response lacked a valid report confirmation.',
          'unknown',
          response.status,
        );
      }

      // Read response error body if available
      let errorMsg = `Server returned HTTP ${response.status}.`;
      try {
        const errorJson: unknown = await response.json();
        logApi('POST /api/reports response', {
          status: response.status,
          body: summarizeResponse(errorJson),
        });
        if (
          typeof errorJson === 'object' &&
          errorJson !== null &&
          'error' in errorJson &&
          typeof errorJson.error === 'string'
        ) {
          errorMsg = errorJson.error;
        }
      } catch {
        logApi('POST /api/reports response', { status: response.status });
      }

      // HTTP 429 Too Many Requests -> Transient / Retryable
      if (response.status === 429) {
        throw new UploadError(
          errorMsg || 'Upload rate limit reached.',
          'http',
          429,
          retryAfter,
        );
      }

      // HTTP 5xx Server Error -> Transient / Retryable
      if (response.status >= 500 && response.status <= 599) {
        throw new UploadError(
          errorMsg || 'Server error encountered during upload.',
          'http',
          response.status,
          retryAfter,
        );
      }

      // HTTP 4xx Client Errors -> Permanent local / validation failures
      throw new UploadError(errorMsg, 'http', response.status, retryAfter);
    } catch (err: unknown) {
      if (err instanceof UploadError) {
        throw err;
      }

      if (signal.aborted) {
        throw new UploadError('Upload request was cancelled.', 'network');
      }

      if (err instanceof Error) {
        if (
          err.name === 'AbortError' ||
          err.message.toLowerCase().includes('timeout')
        ) {
          throw new UploadError(
            'Upload timed out. Check network connection.',
            'timeout',
          );
        }
        if (
          err.message.toLowerCase().includes('network') ||
          err.message.toLowerCase().includes('connection') ||
          err.message.toLowerCase().includes('failed to fetch')
        ) {
          throw new UploadError(
            'Network unreachable. Pending upload will retry when connection is restored.',
            'network',
          );
        }
        throw new UploadError(err.message, 'unknown');
      }

      throw new UploadError(
        'Unexpected error occurred during upload.',
        'unknown',
      );
    }
  }
}
