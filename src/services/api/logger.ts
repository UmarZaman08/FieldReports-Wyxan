type ApiLogDetails = Record<string, unknown>;

/** Development-only API diagnostics. Never include image bytes or credentials. */
export function logApi(event: string, details: ApiLogDetails): void {
  if (__DEV__) console.info(`[FieldReports API] ${event}`, details);
}

export function summarizeResponse(value: unknown): ApiLogDetails {
  if (typeof value !== 'object' || value === null)
    return { responseType: typeof value };

  const body = value as Record<string, unknown>;
  if (Array.isArray(body.reports)) {
    return {
      count: body.count,
      reportIds: body.reports.map(item =>
        typeof item === 'object' && item !== null
          ? (item as Record<string, unknown>).id
          : undefined,
      ),
    };
  }

  return {
    id: body.id,
    clientReportId: body.clientReportId,
    success: body.success,
    keys: Object.keys(body),
  };
}
