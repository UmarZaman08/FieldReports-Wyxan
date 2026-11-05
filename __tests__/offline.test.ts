/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ReportRepository,
  assertTransition,
  type SqlDatabase,
  type SqlValue,
} from '../src/database/repository';
import { ImageStorage, type FileSystem } from '../src/services/image/storage';
import { ReportService } from '../src/services/reports';
import {
  UploadCoordinator,
  UploadError,
  isRetryable,
  retryAfterMs,
  retryDelay,
  type UploadTransport,
} from '../src/services/upload/coordinator';
import type { Report, TemporaryImage } from '../src/types/report';

function database(path = ':memory:') {
  const db = new DatabaseSync(path);
  const adapter: SqlDatabase = {
    executeSync(sql: string, params: SqlValue[] = []) {
      const statement = db.prepare(sql);
      if (/^(SELECT|PRAGMA)/i.test(sql))
        return { rows: statement.all(...params), rowsAffected: 0 };
      return {
        rows: [],
        rowsAffected: Number(statement.run(...params).changes),
      };
    },
  };
  return { db, repo: new ReportRepository(adapter), adapter };
}
function filesystem() {
  const files = new Map<string, number>([['/cache/photo.jpg', 100]]);
  const fs: FileSystem = {
    exists: jest.fn(async path => path === '/images' || files.has(path)),
    stat: jest.fn(async path => {
      if (!files.has(path)) throw new Error('Missing file');
      return { size: files.get(path)! };
    }),
    mkdir: jest.fn(async () => undefined),
    cp: jest.fn(async (source, target) => {
      files.set(target, files.get(source)!);
    }),
    unlink: jest.fn(async path => {
      files.delete(path);
    }),
    ls: jest.fn(async root =>
      [...files.keys()]
        .filter(path => path.startsWith(`${root}/`))
        .map(path => path.slice(root.length + 1)),
    ),
  };
  return { files, fs, storage: new ImageStorage(fs, '/images') };
}
const photo: TemporaryImage = {
  id: 'photo-1',
  uri: 'file:///cache/photo.jpg',
  name: 'photo.jpg',
  size: 100,
  width: 100,
  height: 100,
};
function setup(transport: UploadTransport | null = null) {
  const { db, repo, adapter } = database();
  const { files, fs, storage } = filesystem();
  let id = 0;
  const warning = jest.fn();
  const service = new ReportService(
    repo,
    storage,
    () => `stable-${++id}`,
    transport,
    warning,
  );
  return { db, repo, adapter, files, fs, storage, service, warning };
}
async function queued(
  ctx: ReturnType<typeof setup>,
  description = 'Site inspection',
) {
  return ctx.service.save(description, [photo], undefined, true);
}
const contexts: ReturnType<typeof setup>[] = [];
function context(transport: UploadTransport | null = null) {
  const result = setup(transport);
  contexts.push(result);
  return result;
}
afterEach(() => {
  for (const ctx of contexts.splice(0)) ctx.db.close();
  jest.useRealTimers();
});

test('migrates once and restores draft and photo metadata after closing the database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fieldreports-'));
  const path = join(directory, 'reports.sqlite');
  const first = database(path);
  try {
    first.repo.initialize();
    first.repo.initialize();
    const { storage } = filesystem();
    const service = new ReportService(first.repo, storage, () => 'stable-id');
    const saved = await service.save('Saved draft', [photo]);
    first.db.close();
    const second = database(path);
    try {
      second.repo.initialize();
      expect(second.repo.get(saved.id)).toEqual(saved);
      expect(saved.images[0].uri).toBe('file:///images/stable-id.jpg');
    } finally {
      second.db.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('draft edits preserve identity, replace photos safely, and reject editing queued reports', async () => {
  const ctx = context();
  await ctx.service.initialize();
  const draft = await ctx.service.save('First', [photo]);
  const edited = await ctx.service.save('Edited', [], draft.id);
  expect(edited.idempotencyKey).toBe(draft.idempotencyKey);
  expect(edited.images).toEqual([]);
  expect([...ctx.files.keys()]).toEqual(['/cache/photo.jpg']);
  const submitted = await ctx.service.save('Ready', [photo], draft.id, true);
  expect(submitted.state).toBe('queued');
  await expect(ctx.service.save('Cannot edit', [], draft.id)).rejects.toThrow(
    'Only drafts',
  );
});

test('offline queue saves durably without a configured transport or fake success', async () => {
  const ctx = context();
  await ctx.service.initialize();
  const report = await queued(ctx);
  ctx.service.queue.online = true;
  await ctx.service.queue.run();
  expect(ctx.repo.get(report.id)?.state).toBe('queued');
  expect(ctx.repo.get(report.id)?.attempts).toBe(0);
  expect(
    ctx.files.has(
      ctx.repo.get(report.id)!.images[0].uri.replace('file://', ''),
    ),
  ).toBe(true);
});

test.each([
  ['', 1],
  ['   ', 1],
  ['Valid', 0],
  ['Valid', 6],
  ['x'.repeat(501), 1],
])('rejects invalid queued report %s/%s', async (description, count) => {
  const ctx = context();
  await ctx.service.initialize();
  await expect(
    ctx.service.save(
      description as string,
      Array.from({ length: count as number }, () => photo),
      undefined,
      true,
    ),
  ).rejects.toThrow();
  expect(ctx.repo.list()).toEqual([]);
});

test('image verification rejects missing, empty, oversized, and changed files', async () => {
  const ctx = context();
  for (const size of [0, 5242881, 101]) {
    ctx.files.set('/cache/photo.jpg', size);
    await expect(ctx.storage.verify(photo)).rejects.toThrow();
  }
  ctx.files.delete('/cache/photo.jpg');
  await expect(ctx.storage.verify(photo)).rejects.toThrow('missing');
  ctx.files.set('/cache/photo.jpg', 5242880);
  await expect(
    ctx.storage.verify({ ...photo, size: 5242880 }),
  ).resolves.toBeUndefined();
});

test('partial file-copy failure removes unreferenced copies without creating a record', async () => {
  const ctx = context();
  await ctx.service.initialize();
  jest
    .mocked(ctx.fs.cp)
    .mockImplementationOnce(async (source, target) => {
      ctx.files.set(target, ctx.files.get(source)!);
    })
    .mockRejectedValueOnce(new Error('Disk full'));
  await expect(
    ctx.service.save('Partial', [photo, { ...photo, id: 'photo-2' }]),
  ).rejects.toThrow('Disk full');
  expect(ctx.repo.list()).toEqual([]);
  expect([...ctx.files.keys()]).toEqual(['/cache/photo.jpg']);
});

test('database rollback preserves previous draft and removes newly copied files', async () => {
  const ctx = context();
  await ctx.service.initialize();
  const saved = await ctx.service.save('Original', [photo]);
  // Duplicate image IDs fail the actual SQLite constraint, exercising transaction rollback.
  await expect(
    ctx.service.save('Broken', [photo, photo], saved.id),
  ).rejects.toThrow();
  expect(ctx.repo.get(saved.id)).toEqual(saved);
  expect(
    [...ctx.files.keys()].filter(path => path.startsWith('/images/')),
  ).toEqual([saved.images[0].uri.replace('file://', '')]);
});

test('cleanup failure after commit warns without reporting a failed save or losing the identity', async () => {
  const ctx = context();
  await ctx.service.initialize();
  ctx.files.set('/images/orphan.jpg', 10);
  jest.mocked(ctx.fs.unlink).mockRejectedValueOnce(new Error('Busy'));
  const saved = await ctx.service.save('Saved', [photo]);
  expect(ctx.repo.get(saved.id)).toEqual(saved);
  expect(ctx.warning).toHaveBeenCalled();
});

test('allowed transitions reject false success and edits to completed reports', () => {
  expect(() => assertTransition('draft', 'queued')).not.toThrow();
  expect(() => assertTransition('uploading', 'uploaded')).not.toThrow();
  for (const from of [
    'draft',
    'queued',
    'failed',
    'retry_wait',
    'uploaded',
  ] as const)
    expect(() => assertTransition(from, 'uploaded')).toThrow();
  expect(() => assertTransition('uploaded', 'queued')).toThrow();
});

test.each([
  [new UploadError('Network', 'network'), true],
  [new UploadError('Timeout', 'timeout'), true],
  [new UploadError('Rate limited', 'http', 429), true],
  [new UploadError('Server', 'http', 503), true],
  [new UploadError('Invalid', 'http', 422), false],
  [new UploadError('Missing', 'local'), false],
  [new Error('Unknown'), false],
])('classifies %s', (error, retry) => {
  expect(isRetryable(error)).toBe(retry);
});

test('backoff increases with bounded jitter and respects Retry-After dates and seconds', () => {
  expect(retryDelay(1, () => 0)).toBe(1000);
  expect(retryDelay(2, () => 0)).toBe(2000);
  expect(retryDelay(100, () => 0.999)).toBeLessThanOrEqual(300000);
  expect(retryDelay(100, () => 0)).toBe(150000);
  expect(retryAfterMs('120', 0)).toBe(120000);
  expect(retryAfterMs('Thu, 01 Jan 1970 00:02:00 GMT', 1000)).toBe(119000);
  expect(retryAfterMs('invalid', 0)).toBe(0);
});

test('processes FIFO sequentially and coalesces duplicate worker calls', async () => {
  let release: (() => void) | undefined;
  const blocked = new Promise<void>(resolve => {
    release = resolve;
  });
  const upload = jest.fn(async () => {
    await blocked;
    return { confirmed: true as const };
  });
  const ctx = context({ upload });
  await ctx.service.initialize();
  const first = await queued(ctx, 'First');
  const second = await queued(ctx, 'Second');
  ctx.service.queue.online = true;
  const a = ctx.service.queue.run();
  const b = ctx.service.queue.run();
  expect(a).toBe(b);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  release!();
  await a;
  expect(
    upload.mock.calls.map(call => (call as unknown as [Report])[0].id),
  ).toEqual([first.id, second.id]);
  expect(ctx.repo.list().every(report => report.state === 'uploaded')).toBe(
    true,
  );
});

test('persists retry timing, skips premature attempts, and reuses the idempotency key', async () => {
  const upload = jest
    .fn<
      ReturnType<UploadTransport['upload']>,
      Parameters<UploadTransport['upload']>
    >()
    .mockRejectedValueOnce(new UploadError('Rate limited', 'http', 429, '120'))
    .mockResolvedValue({ confirmed: true });
  const ctx = context();
  await ctx.service.initialize();
  const report = await queued(ctx);
  let now = 1000;
  const coordinator = new UploadCoordinator(
    ctx.repo,
    async () => {},
    { upload },
    () => now,
    () => 0,
  );
  coordinator.online = true;
  await coordinator.run();
  expect(ctx.repo.get(report.id)?.nextAttemptAt).toBe(121000);
  await coordinator.run();
  expect(upload).toHaveBeenCalledTimes(1);
  now = 121000;
  await coordinator.run();
  expect(upload.mock.calls.map(call => call[0].idempotencyKey)).toEqual([
    report.idempotencyKey,
    report.idempotencyKey,
  ]);
  expect(ctx.repo.get(report.id)?.state).toBe('uploaded');
});

test('recovers interrupted uploading records without changing the idempotency key', async () => {
  const ctx = context();
  await ctx.service.initialize();
  const report = await queued(ctx);
  ctx.repo.transition(report.id, 'uploading', { attempts: 1 });
  ctx.repo.recover();
  expect(ctx.repo.get(report.id)).toMatchObject({
    state: 'retry_wait',
    attempts: 1,
    idempotencyKey: report.idempotencyKey,
  });
});

test('permanent errors and invalid confirmations fail without retry loops; manual retry preserves key', async () => {
  const upload = jest
    .fn()
    .mockRejectedValue(new UploadError('Invalid report', 'http', 400));
  const ctx = context({ upload });
  await ctx.service.initialize();
  const report = await queued(ctx);
  ctx.service.queue.online = true;
  await ctx.service.queue.run();
  expect(ctx.repo.get(report.id)?.state).toBe('failed');
  expect(upload).toHaveBeenCalledTimes(1);
  await ctx.service.retry(report.id);
  expect(ctx.repo.get(report.id)).toMatchObject({
    idempotencyKey: report.idempotencyKey,
    state: 'queued',
    attempts: 0,
  });
  upload.mockResolvedValue({ confirmed: false });
  await ctx.service.queue.run();
  expect(ctx.repo.get(report.id)?.state).toBe('failed');
});

test('times out a stalled transport and persists retry state', async () => {
  jest.useFakeTimers();
  const ctx = context();
  await ctx.service.initialize();
  const report = await queued(ctx);
  const coordinator = new UploadCoordinator(
    ctx.repo,
    async () => {},
    { upload: async () => new Promise(() => {}) },
    () => 1000,
    () => 0,
    100,
  );
  coordinator.online = true;
  const running = coordinator.run();
  await jest.advanceTimersByTimeAsync(101);
  await running;
  expect(ctx.repo.get(report.id)).toMatchObject({
    state: 'retry_wait',
    attempts: 1,
    nextAttemptAt: 2000,
  });
});

test('missing durable images fail locally without calling the transport', async () => {
  const upload = jest.fn(async () => ({ confirmed: true as const }));
  const ctx = context({ upload });
  await ctx.service.initialize();
  const report = await queued(ctx);
  ctx.files.delete(report.images[0].uri.replace('file://', ''));
  ctx.service.queue.online = true;
  await ctx.service.queue.run();
  expect(upload).not.toHaveBeenCalled();
  expect(ctx.repo.get(report.id)?.state).toBe('failed');
});

test('reset cancels a stalled upload, clears records before files, and preserves outside files', async () => {
  const upload = jest.fn(
    async () => new Promise<{ confirmed: true }>(() => {}),
  );
  const ctx = context({ upload });
  await ctx.service.initialize();
  await queued(ctx);
  ctx.service.queue.online = true;
  const running = ctx.service.queue.run();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await ctx.service.reset();
  await running;
  expect(ctx.repo.list()).toEqual([]);
  expect([...ctx.files.keys()]).toEqual(['/cache/photo.jpg']);
});

test('reset cleanup can be retried after file deletion failure without dangling database paths', async () => {
  const ctx = context();
  await ctx.service.initialize();
  await queued(ctx);
  jest.mocked(ctx.fs.unlink).mockRejectedValueOnce(new Error('Locked'));
  await expect(ctx.service.reset()).rejects.toThrow('Locked');
  expect(ctx.repo.list()).toEqual([]);
  await ctx.service.reset();
  expect([...ctx.files.keys()]).toEqual(['/cache/photo.jpg']);
});

test('network hints pause processing and returning connectivity resumes eligible work', async () => {
  const upload = jest.fn(async () => ({ confirmed: true as const }));
  const ctx = context({ upload });
  await ctx.service.initialize();
  const saved = await queued(ctx);
  await ctx.service.queue.run();
  expect(upload).not.toHaveBeenCalled();
  ctx.service.queue.online = true;
  await ctx.service.queue.run();
  expect(ctx.repo.get(saved.id)).toBeUndefined();
  expect(ctx.files.has(saved.images[0].uri.replace('file://', ''))).toBe(false);
});

test('retry exhaustion requires manual action instead of retrying forever', async () => {
  const upload = jest.fn(async () => {
    throw new UploadError('Disconnected', 'network');
  });
  const ctx = context();
  await ctx.service.initialize();
  const saved = await queued(ctx);
  let now = 0;
  const queue = new UploadCoordinator(
    ctx.repo,
    async () => {},
    { upload },
    () => now,
    () => 0,
  );
  queue.online = true;
  for (let attempt = 1; attempt <= 8; attempt++) {
    await queue.run();
    const report = ctx.repo.get(saved.id)!;
    expect(report.attempts).toBe(attempt);
    now = report.nextAttemptAt ?? now;
  }
  expect(ctx.repo.get(saved.id)?.state).toBe('failed');
  await queue.run();
  expect(upload).toHaveBeenCalledTimes(8);
});

test('startup removes interrupted copies while retaining every saved draft and queued photo', async () => {
  const ctx = context();
  await ctx.service.initialize();
  const draft = await ctx.service.save('Draft', [photo]);
  await queued(ctx);
  ctx.files.set('/images/interrupted-copy.jpg', 25);
  await ctx.service.initialize();
  expect(ctx.files.has('/images/interrupted-copy.jpg')).toBe(false);
  expect(ctx.repo.get(draft.id)?.images).toEqual(draft.images);
  expect(
    [...ctx.files.keys()].filter(path => path.startsWith('/images/')),
  ).toHaveLength(2);
});
