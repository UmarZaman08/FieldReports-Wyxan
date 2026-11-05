import type { Report, TemporaryImage } from '../types/report';
import { ReportRepository } from '../database/repository';
import { ImageStorage } from './image/storage';
import {
  UploadCoordinator,
  UploadError,
  type UploadTransport,
} from './upload/coordinator';
import { validateReport, MAX_REPORT_IMAGES } from '../screens/Draft/validation';

export class ReportService {
  readonly queue: UploadCoordinator;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    readonly repo: ReportRepository,
    readonly images: ImageStorage,
    private uuid: () => string,
    transport: UploadTransport | null = null,
    private warning: (message: string) => void = () => {},
    private closeDatabase: () => void = () => {},
  ) {
    this.queue = new UploadCoordinator(
      repo,
      async report => {
        const error = validateReport(report.description, report.images.length);
        if (error) throw new UploadError(error, 'local');
        try {
          for (const image of report.images) await images.verify(image);
        } catch (failure) {
          throw new UploadError(
            failure instanceof Error ? failure.message : 'Photo unavailable.',
            'local',
          );
        }
      },
      transport,
      Date.now,
      Math.random,
      120000,
      async report => {
        try {
          this.repo.removeUploaded(report.id);
          await this.cleanup();
        } catch (error) {
          this.warning(
            error instanceof Error
              ? `The server confirmed the report, but local cleanup will retry: ${error.message}`
              : 'The server confirmed the report, but local cleanup will retry.',
          );
        }
      },
    );
  }
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work);
    this.tail = result.catch(() => undefined);
    return result;
  }
  async initialize(): Promise<void> {
    this.repo.initialize();
    await this.images.initialize();
    this.repo.recover();
    // Covers a process exit after server confirmation but before photo cleanup.
    this.repo.purgeUploaded();
    await this.cleanupSafely();
  }
  async dispose(): Promise<void> {
    await this.queue.suspend();
    await this.tail;
    this.closeDatabase();
  }
  private async cleanupSafely(): Promise<void> {
    try {
      await this.cleanup();
    } catch {
      this.warning(
        'Some unused photos could not be removed. Cleanup will retry at the next save, reset, or launch.',
      );
    }
  }
  private cleanup(): Promise<void> {
    return this.images.clean(
      this.repo.list().flatMap(report => report.images.map(image => image.uri)),
    );
  }
  save(
    description: string,
    images: TemporaryImage[],
    id?: string,
    queue = false,
  ): Promise<Report> {
    return this.exclusive(async () => {
      if (description.length > 500 || images.length > MAX_REPORT_IMAGES)
        throw new Error('Use at most 500 characters and five photos.');
      if (queue) {
        const error = validateReport(description, images.length);
        if (error) throw new Error(error);
      }
      const old = id ? this.repo.get(id) : undefined;
      if (id && !old) throw new Error('This draft no longer exists.');
      if (old && old.state !== 'draft')
        throw new Error('Only drafts can be edited.');
      const reportId = old?.id ?? this.uuid();
      const savedImages: TemporaryImage[] = [];
      try {
        for (const image of images) {
          const existing = old?.images.find(
            item => item.id === image.id && item.uri === image.uri,
          );
          if (existing) {
            await this.images.verify(existing);
            savedImages.push(existing);
          } else savedImages.push(await this.images.copy(image, this.uuid()));
        }
        const now = Date.now();
        const report: Report = {
          id: reportId,
          idempotencyKey: old?.idempotencyKey ?? reportId,
          description: description.trim(),
          images: savedImages,
          state: 'draft',
          attempts: 0,
          nextAttemptAt: null,
          lastError: null,
          createdAt: old?.createdAt ?? now,
          updatedAt: now,
          queuedAt: null,
        };
        this.repo.saveDraft(report, queue);
        return this.repo.get(report.id)!;
      } finally {
        // Metadata commits before deletion. A failed cleanup is surfaced; launch retries it.
        await this.cleanupSafely();
      }
    });
  }
  deleteDraft(id: string): Promise<void> {
    return this.exclusive(async () => {
      this.repo.removeDraft(id);
      await this.cleanup();
    });
  }
  retry(id: string): Promise<void> {
    return this.exclusive(async () => {
      const report = this.repo.get(id);
      if (!report || report.state !== 'failed')
        throw new Error('Only failed reports can be retried.');
      for (const image of report.images) await this.images.verify(image);
      this.repo.transition(id, 'queued', { attempts: 0 });
    });
  }
  reset(): Promise<void> {
    return this.exclusive(async () => {
      await this.queue.suspend();
      try {
        this.repo.reset();
        await this.cleanup();
      } finally {
        this.queue.resume();
      }
    });
  }
}
