import axios from 'axios';
import {
  apiErrorMessage,
  createApiClient,
  getReports,
  getReportById,
  deleteReport,
  parseReportsEnvelope,
} from '../src/services/api/client';
import {
  getApiBaseUrl,
  setApiBaseUrl,
  resetApiBaseUrl,
  isValidBackendUrl,
} from '../src/config/env';

describe('API client and dynamic configuration', () => {
  beforeEach(() => {
    resetApiBaseUrl();
  });

  describe('configuration layer', () => {
    test('provides default backend URL without hardcoding in components', () => {
      expect(getApiBaseUrl()).toBe('https://backend-five-omega-74.vercel.app');
    });

    test('validates backend URL formats', () => {
      expect(isValidBackendUrl('https://example.com')).toBe(true);
      expect(isValidBackendUrl('http://10.0.2.2:3000')).toBe(true);
      expect(isValidBackendUrl('invalid-url')).toBe(false);
      expect(isValidBackendUrl('')).toBe(false);
    });

    test('allows dynamic URL updates and reset', () => {
      setApiBaseUrl('https://custom-api.example.com');
      expect(getApiBaseUrl()).toBe('https://custom-api.example.com');
      resetApiBaseUrl();
      expect(getApiBaseUrl()).toBe('https://backend-five-omega-74.vercel.app');
    });

    test('rejects invalid URLs when setting', () => {
      expect(() => setApiBaseUrl('bad-url')).toThrow('valid HTTP/HTTPS URL');
    });
  });

  describe('envelope parsing', () => {
    test('parses the observed empty envelope', () => {
      expect(parseReportsEnvelope({ count: 0, reports: [] })).toEqual({
        count: 0,
        reports: [],
      });
    });

    test.each([
      null,
      [],
      {},
      { count: -1, reports: [] },
      { count: 0.5, reports: [] },
      { count: 1, reports: {} },
    ])('rejects malformed envelope %p', value => {
      expect(() => parseReportsEnvelope(value)).toThrow(
        'invalid reports response',
      );
    });

    test('preserves verified records', () => {
      const records = [
        {
          id: 'test-id',
          clientReportId: 'client-id',
          description: 'test description',
          images: [],
          createdAt: '2026-11-05T00:00:00Z',
          updatedAt: '2026-11-05T00:00:00Z',
        },
      ];
      expect(
        parseReportsEnvelope({ count: 1, reports: records }).reports,
      ).toEqual(records);
    });
  });

  describe('HTTP operations', () => {
    test.each(['', 'http://example.com', 'not-a-url'])(
      'rejects missing or insecure configuration %p',
      url => {
        expect(() => createApiClient(url)).toThrow('HTTPS backend URL');
      },
    );

    test('requests getReports and forwards cancellation', async () => {
      const client = createApiClient('https://example.com');
      const get = jest
        .spyOn(client, 'get')
        .mockResolvedValue({ data: { count: 0, reports: [] } });
      const signal = new AbortController().signal;
      await expect(getReports(signal, client)).resolves.toEqual({
        count: 0,
        reports: [],
      });
      expect(get).toHaveBeenCalledWith('/api/reports', { signal });
      get.mockRestore();
    });

    test('requests getReportById', async () => {
      const client = createApiClient('https://example.com');
      const mockReport = {
        id: '123',
        clientReportId: 'c-123',
        description: 'Bridge inspection',
        images: [],
        createdAt: '2026-11-05T00:00:00.000Z',
        updatedAt: '2026-11-05T00:00:00.000Z',
      };
      const get = jest
        .spyOn(client, 'get')
        .mockResolvedValue({ data: mockReport });
      const signal = new AbortController().signal;
      await expect(getReportById('123', signal, client)).resolves.toEqual(
        mockReport,
      );
      expect(get).toHaveBeenCalledWith('/api/reports/123', { signal });
      get.mockRestore();
    });

    test('requests deleteReport and handles success response', async () => {
      const client = createApiClient('https://example.com');
      const del = jest.spyOn(client, 'delete').mockResolvedValue({
        data: {
          success: true,
          id: '123',
          message: 'Report deleted successfully',
        },
      });
      const signal = new AbortController().signal;
      await expect(deleteReport('123', signal, client)).resolves.toEqual({
        success: true,
        id: '123',
        message: 'Report deleted successfully',
      });
      expect(del).toHaveBeenCalledWith('/api/reports/123', { signal });
      del.mockRestore();
    });

    test('rejects invalid network responses', async () => {
      const client = createApiClient('https://example.com');
      jest.spyOn(client, 'get').mockResolvedValue({ data: { success: true } });
      await expect(
        getReports(new AbortController().signal, client),
      ).rejects.toThrow('invalid reports response');
    });

    test('normalizes timeout, connectivity and HTTP failures without exposing payloads', () => {
      expect(
        apiErrorMessage(new axios.AxiosError('private', 'ECONNABORTED')),
      ).toContain('too long');
      expect(
        apiErrorMessage(new axios.AxiosError('private', 'ERR_NETWORK')),
      ).toContain('connection');
      const error = new axios.AxiosError('private');
      Object.assign(error, { response: { status: 503, data: 'private' } });
      expect(apiErrorMessage(error)).toBe(
        'The server returned HTTP 503. Try again later.',
      );
    });
  });
});
