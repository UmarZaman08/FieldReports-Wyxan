import type { Report } from '../../types/report';
import type { ReportRepository } from '../../database/repository';

// An adapter may return this only after validating the real backend's confirmation.
// This is an internal result, not an invented HTTP response contract.
export interface UploadConfirmation {
  confirmed: true;
}
export interface UploadTransport {
  upload(
    report: Readonly<Report>,
    signal: AbortSignal,
  ): Promise<UploadConfirmation>;
}

export interface UploadResultEvent {
  status: 'success' | 'error' | 'warning';
  message: string;
}
export class UploadError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'timeout' | 'http' | 'local' | 'unknown',
    readonly status?: number,
    readonly retryAfter?: string,
  ) {
    super(message);
  }
}
export function isRetryable(error: unknown): boolean {
  return (
    error instanceof UploadError &&
    (error.kind === 'network' ||
      error.kind === 'timeout' ||
      (error.kind === 'http' &&
        (error.status === 429 ||
          (error.status !== undefined &&
            error.status >= 500 &&
            error.status <= 599))))
  );
}
export function retryDelay(attempt: number, random = Math.random): number {
  const cap = Math.min(
    300000,
    2000 * 2 ** Math.min(Math.max(0, attempt - 1), 20),
  );
  return Math.floor(cap / 2 + (random() * cap) / 2);
}
export function retryAfterMs(value: string | undefined, now: number): number {
  if (!value) return 0;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.max(0, delay) : 0;
}
export class UploadCoordinator {
  private running: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private paused = false;
  private readonly confirmationListeners = new Set<(report: Report) => void>();
  private readonly resultListeners = new Set<(event: UploadResultEvent) => void>();
  online = false;
  constructor(
    private repo: ReportRepository,
    private verify: (report: Report) => Promise<void>,
    readonly transport: UploadTransport | null = null,
    private now = Date.now,
    private random = Math.random,
    private timeoutMs = 120000,
    private onConfirmed: (report: Report) => Promise<void> = async () => {},
  ) {}
  get configured(): boolean {
    return this.transport !== null;
  }
  subscribeToConfirmations(listener: (report: Report) => void): () => void {
    this.confirmationListeners.add(listener);
    return () => this.confirmationListeners.delete(listener);
  }
  subscribeToResults(listener: (event: UploadResultEvent) => void): () => void {
    this.resultListeners.add(listener);
    return () => this.resultListeners.delete(listener);
  }
  private notifyResult(event: UploadResultEvent): void {
    for (const listener of this.resultListeners) {
      try {
        listener(event);
      } catch {
        // UI observers must not change the persisted upload outcome.
      }
    }
  }
  run(): Promise<void> {
    if (this.running) return this.running;
    if (this.paused || !this.online || !this.transport)
      return Promise.resolve();
    this.running = this.process().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  async suspend(): Promise<void> {
    this.paused = true;
    this.controller?.abort();
    await this.running;
  }
  resume(): void {
    this.paused = false;
  }
  private async process(): Promise<void> {
    while (!this.paused && this.online && this.transport) {
      const report = this.repo.next(this.now());
      if (!report) return;
      const claimed = this.repo.transition(
        report.id,
        'uploading',
        { attempts: report.attempts + 1 },
        this.now(),
      );
      const controller = new AbortController();
      this.controller = controller;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await this.verify(claimed);
        if (controller.signal.aborted)
          throw new UploadError('Upload interrupted.', 'network');
        const confirmation = await Promise.race([
          this.transport.upload(claimed, controller.signal),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener(
              'abort',
              () =>
                reject(
                  new UploadError(
                    'Upload interrupted or timed out.',
                    'timeout',
                  ),
                ),
              { once: true },
            );
            timer = setTimeout(() => controller.abort(), this.timeoutMs);
          }),
        ]);
        if (confirmation?.confirmed !== true)
          throw new UploadError(
            'The server did not confirm this upload.',
            'unknown',
          );
        const confirmed = this.repo.transition(
          report.id,
          'uploaded',
          {},
          this.now(),
        );
        // Server confirmation is authoritative. Local cleanup failures are handled
        // by startup orphan cleanup and must not turn a confirmed upload into failure.
        await this.onConfirmed(confirmed);
        this.notifyResult({
          status: 'success',
          message: 'The server confirmed your report and it was removed from this device.',
        });
        for (const listener of this.confirmationListeners) {
          try {
            listener(confirmed);
          } catch {
            // A UI observer must not change the persisted upload outcome.
          }
        }
      } catch (error) {
        const attempts = report.attempts + 1;
        const retry = isRetryable(error) && attempts < 8;
        const now = this.now();
        const failed = this.repo.transition(
          report.id,
          retry ? 'retry_wait' : 'failed',
          {
            nextAttemptAt: retry
              ? now +
                Math.max(
                  retryDelay(attempts, this.random),
                  retryAfterMs(
                    error instanceof UploadError ? error.retryAfter : undefined,
                    now,
                  ),
                )
              : null,
            lastError:
              error instanceof Error
                ? error.message
                : 'Unknown upload failure. Manual review required.',
          },
          now,
        );
        this.notifyResult({
          status: retry ? 'warning' : 'error',
          message: failed.lastError ?? 'The report could not be uploaded.',
        });
      } finally {
        if (timer) clearTimeout(timer);
        this.controller = null;
      }
    }
  }
}
