export interface TemporaryImage {
  id: string;
  uri: string;
  name: string;
  size: number;
  width: number;
  height: number;
}
export type UploadState =
  | 'draft'
  | 'queued'
  | 'uploading'
  | 'retry_wait'
  | 'failed'
  | 'uploaded';
export interface Report {
  id: string;
  idempotencyKey: string;
  description: string;
  images: TemporaryImage[];
  state: UploadState;
  attempts: number;
  nextAttemptAt: number | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
  queuedAt: number | null;
}
