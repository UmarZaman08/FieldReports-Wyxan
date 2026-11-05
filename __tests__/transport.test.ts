import { HttpUploadTransport } from '../src/services/upload/transport';
import { UploadError, isRetryable } from '../src/services/upload/coordinator';
import type { Report } from '../src/types/report';

describe('HttpUploadTransport', () => {
  const mockReport: Report = {
    id: 'rep-uuid-1',
    idempotencyKey: 'idem-uuid-1',
    description: 'Cracked concrete on pillar 4',
    images: [
      {
        id: 'img-1',
        uri: 'file:///data/user/0/report-images/photo1.jpg',
        name: 'photo1.jpg',
        size: 102400,
        width: 800,
        height: 600,
      },
    ],
    state: 'queued',
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    queuedAt: 1700000000000,
  };

  test('confirms successful 201 Created upload', async () => {
    let capturedUrl = '';
    let capturedBody: any;

    const mockFetcher = jest.fn().mockImplementation((url, init) => {
      capturedUrl = url;
      capturedBody = init.body;
      return Promise.resolve({
        status: 201,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            id: 'server-id-123',
            clientReportId: 'idem-uuid-1',
            description: 'Cracked concrete on pillar 4',
          }),
      });
    });

    const transport = new HttpUploadTransport({
      getBaseUrl: () => 'https://backend-five-omega-74.vercel.app',
      fetcher: mockFetcher,
    });

    const signal = new AbortController().signal;
    const result = await transport.upload(mockReport, signal);

    expect(result).toEqual({ confirmed: true });
    expect(capturedUrl).toBe(
      'https://backend-five-omega-74.vercel.app/api/reports',
    );
    expect(capturedBody).toBeInstanceOf(FormData);
  });

  test('confirms idempotent duplicate 200 OK replay', async () => {
    const mockFetcher = jest.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      json: () =>
        Promise.resolve({
          id: 'server-id-existing',
          clientReportId: 'idem-uuid-1',
        }),
    });

    const transport = new HttpUploadTransport({
      fetcher: mockFetcher,
    });

    const signal = new AbortController().signal;
    const result = await transport.upload(mockReport, signal);

    expect(result).toEqual({ confirmed: true });
  });

  test('handles 429 Too Many Requests as retryable with Retry-After', async () => {
    const headers = new Headers();
    headers.set('Retry-After', '60');

    const mockFetcher = jest.fn().mockResolvedValue({
      status: 429,
      headers,
      json: () => Promise.resolve({ error: 'Rate limit reached' }),
    });

    const transport = new HttpUploadTransport({ fetcher: mockFetcher });

    try {
      await transport.upload(mockReport, new AbortController().signal);
      fail('Expected upload to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(UploadError);
      const uploadErr = err as UploadError;
      expect(uploadErr.status).toBe(429);
      expect(uploadErr.retryAfter).toBe('60');
      expect(isRetryable(uploadErr)).toBe(true);
    }
  });

  test('handles 500/503 Server Error as retryable', async () => {
    const mockFetcher = jest.fn().mockResolvedValue({
      status: 503,
      headers: new Headers(),
      json: () => Promise.resolve({ error: 'Service Unavailable' }),
    });

    const transport = new HttpUploadTransport({ fetcher: mockFetcher });

    try {
      await transport.upload(mockReport, new AbortController().signal);
      fail('Expected upload to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(UploadError);
      const uploadErr = err as UploadError;
      expect(uploadErr.status).toBe(503);
      expect(isRetryable(uploadErr)).toBe(true);
    }
  });

  test('handles 400 Bad Request / 413 Payload Too Large as permanent non-retryable failure', async () => {
    const mockFetcher = jest.fn().mockResolvedValue({
      status: 413,
      headers: new Headers(),
      json: () =>
        Promise.resolve({
          error: 'Image exceeds 5 MB ceiling limit.',
          code: 'PAYLOAD_TOO_LARGE',
        }),
    });

    const transport = new HttpUploadTransport({ fetcher: mockFetcher });

    try {
      await transport.upload(mockReport, new AbortController().signal);
      fail('Expected upload to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(UploadError);
      const uploadErr = err as UploadError;
      expect(uploadErr.status).toBe(413);
      expect(uploadErr.message).toContain('5 MB');
      expect(isRetryable(uploadErr)).toBe(false);
    }
  });

  test('handles network failure as retryable network error', async () => {
    const mockFetcher = jest
      .fn()
      .mockRejectedValue(new Error('Network request failed'));

    const transport = new HttpUploadTransport({ fetcher: mockFetcher });

    try {
      await transport.upload(mockReport, new AbortController().signal);
      fail('Expected upload to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(UploadError);
      const uploadErr = err as UploadError;
      expect(uploadErr.kind).toBe('network');
      expect(isRetryable(uploadErr)).toBe(true);
    }
  });

  test('handles cancellation via AbortSignal', async () => {
    const controller = new AbortController();
    controller.abort();

    const mockFetcher = jest.fn().mockImplementation(() => {
      const err = new Error('The user aborted a request.');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const transport = new HttpUploadTransport({ fetcher: mockFetcher });

    try {
      await transport.upload(mockReport, controller.signal);
      fail('Expected upload to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(UploadError);
    }
  });
});
