export const MIN_REPORT_IMAGES = 1;
export const MAX_REPORT_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateReport(description: string, imageCount: number): string | null {
  if (description.trim().length === 0) return 'Add a short description before creating the report.';
  if (imageCount < MIN_REPORT_IMAGES) return 'Add at least one photo to continue.';
  if (imageCount > MAX_REPORT_IMAGES) return 'A report can include up to five photos.';
  return null;
}
