import axios, { type AxiosInstance } from 'axios';
import { getApiBaseUrl, ENV } from '../../config/env';
import { logApi, summarizeResponse } from './logger';

export const getClientBaseUrl = (): string => getApiBaseUrl();

// Exported for backward-compatibility; dynamically accesses configured base URL
export const API_BASE_URL = getApiBaseUrl();

export interface ServerReportImage {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  url: string;
}

export interface ServerReport {
  id: string;
  clientReportId: string;
  description: string;
  images: ServerReportImage[];
  createdAt: string;
  updatedAt: string;
}

export interface ReportsEnvelope {
  count: number;
  reports: ServerReport[];
}

export function toSecureImageUrl(url: string | undefined): string {
  if (!url) return '';
  return url.replace(/^http:\/\//i, 'https://');
}

export function parseReportsEnvelope(value: unknown): ReportsEnvelope {
  if (typeof value !== 'object' || value === null)
    throw new Error('The server returned an invalid reports response.');
  const record = value as Record<string, unknown>;
  if (
    !Number.isSafeInteger(record.count) ||
    (record.count as number) < 0 ||
    !Array.isArray(record.reports)
  )
    throw new Error('The server returned an invalid reports response.');

  const reports = record.reports.map(parseServerReport);

  return { count: record.count as number, reports };
}

function parseServerReport(value: unknown): ServerReport {
  if (typeof value !== 'object' || value === null)
    throw new Error('The server returned an invalid report.');
  const report = value as Record<string, unknown>;
  if (
    typeof report.id !== 'string' ||
    typeof report.clientReportId !== 'string' ||
    typeof report.description !== 'string' ||
    typeof report.createdAt !== 'string' ||
    typeof report.updatedAt !== 'string' ||
    !Array.isArray(report.images)
  )
    throw new Error('The server returned an invalid report.');

  const images: ServerReportImage[] = report.images.map(imageValue => {
    if (typeof imageValue !== 'object' || imageValue === null)
      throw new Error('The server returned an invalid report photo.');
    const image = imageValue as Record<string, unknown>;
    if (
      typeof image.id !== 'string' ||
      typeof image.filename !== 'string' ||
      typeof image.originalName !== 'string' ||
      typeof image.size !== 'number' ||
      typeof image.mimetype !== 'string' ||
      typeof image.url !== 'string'
    )
      throw new Error('The server returned an invalid report photo.');
    return {
      id: image.id,
      filename: image.filename,
      originalName: image.originalName,
      size: image.size,
      mimetype: image.mimetype,
      url: toSecureImageUrl(image.url),
    };
  });

  return {
    id: report.id,
    clientReportId: report.clientReportId,
    description: report.description,
    images,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

export function createApiClient(
  baseURL: string = getApiBaseUrl(),
): AxiosInstance {
  if (!baseURL.trim() || !/^https:\/\/[^/\s]+(?:\/[^\s]*)?$/.test(baseURL))
    throw new Error('Configure a valid HTTPS backend URL.');
  return axios.create({ baseURL, timeout: ENV.REQUEST_TIMEOUT_MS });
}

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
      return 'The server took too long to respond. Pull to refresh or try again.';
    if (error.response)
      return `The server returned HTTP ${error.response.status}. Try again later.`;
    return 'Could not reach the server. Check your connection and try again.';
  }
  return error instanceof Error
    ? error.message
    : 'Could not load server reports.';
}

export function getClient(): AxiosInstance {
  return createApiClient(getApiBaseUrl());
}

export async function getReports(
  signal: AbortSignal,
  api: Pick<AxiosInstance, 'get'> = getClient(),
): Promise<ReportsEnvelope> {
  logApi('GET /api/reports request', { method: 'GET', path: '/api/reports' });
  try {
    const response = await api.get<unknown>('/api/reports', { signal });
    logApi('GET /api/reports response', {
      status: response.status,
      body: summarizeResponse(response.data),
    });
    return parseReportsEnvelope(response.data);
  } catch (error) {
    logApi('GET /api/reports error', { message: apiErrorMessage(error) });
    throw error;
  }
}

export async function getReportById(
  id: string,
  signal?: AbortSignal,
  api: Pick<AxiosInstance, 'get'> = getClient(),
): Promise<ServerReport> {
  const path = `/api/reports/${encodeURIComponent(id)}`;
  logApi('GET /api/reports/:id request', { method: 'GET', path });
  try {
    const response = await api.get<unknown>(path, { signal });
    logApi('GET /api/reports/:id response', {
      status: response.status,
      body: summarizeResponse(response.data),
    });
    return parseServerReport(response.data);
  } catch (error) {
    logApi('GET /api/reports/:id error', { message: apiErrorMessage(error) });
    throw error;
  }
}

export async function deleteReport(
  id: string,
  signal?: AbortSignal,
  api: Pick<AxiosInstance, 'delete'> = getClient(),
): Promise<{ success: boolean; id: string }> {
  const path = `/api/reports/${encodeURIComponent(id)}`;
  logApi('DELETE /api/reports/:id request', { method: 'DELETE', path });
  try {
    const response = await api.delete<{
      success: boolean;
      id: string;
      message?: string;
    }>(path, { signal });
    logApi('DELETE /api/reports/:id response', {
      status: response.status,
      body: summarizeResponse(response.data),
    });
    if (response.data.success !== true || response.data.id !== id)
      throw new Error('The server did not confirm this report deletion.');
    return response.data;
  } catch (error) {
    logApi('DELETE /api/reports/:id error', {
      message: apiErrorMessage(error),
    });
    throw error;
  }
}

/** Deletes the complete server report set only when the API returned it in full. */
export async function deleteAllServerReports(
  signal: AbortSignal,
): Promise<{ deletedCount: number }> {
  const api = getClient();
  const initial = await getReports(signal, api);
  if (initial.count !== initial.reports.length) {
    throw new Error(
      'The server did not return its complete report list. No reports were deleted.',
    );
  }

  let deletedCount = 0;
  for (const report of initial.reports) {
    try {
      await deleteReport(report.id, signal, api);
      deletedCount += 1;
    } catch (error) {
      const detail = apiErrorMessage(error);
      throw new Error(
        deletedCount > 0
          ? `Deleted ${deletedCount} of ${initial.count} reports before stopping. ${detail}`
          : detail,
      );
    }
  }

  const final = await getReports(signal, api);
  if (final.count !== 0 || final.reports.length !== 0) {
    throw new Error(
      `Deleted ${deletedCount} reports, but the server still returns ${final.count} reports.`,
    );
  }
  return { deletedCount };
}
