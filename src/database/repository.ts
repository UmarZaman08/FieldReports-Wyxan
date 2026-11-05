import type { Report, UploadState } from '../types/report';

export type SqlValue = string | number | null;
export interface SqlDatabase {
  executeSync(
    sql: string,
    params?: SqlValue[],
  ): { rows: Record<string, unknown>[]; rowsAffected: number };
}
const states: UploadState[] = [
  'draft',
  'queued',
  'uploading',
  'retry_wait',
  'failed',
  'uploaded',
];
export const transitions: Record<UploadState, readonly UploadState[]> = {
  draft: ['queued'],
  queued: ['uploading'],
  uploading: ['uploaded', 'retry_wait', 'failed'],
  retry_wait: ['uploading', 'queued'],
  failed: ['queued'],
  uploaded: [],
};
export function assertTransition(from: UploadState, to: UploadState): void {
  if (!transitions[from].includes(to))
    throw new Error(`Invalid report transition: ${from} → ${to}`);
}

// This connection belongs exclusively to the repository. Transactions contain no awaits.
export class ReportRepository {
  constructor(
    private db: SqlDatabase,
    private changed: () => void = () => {},
  ) {}
  private transaction(work: () => void): void {
    this.db.executeSync('BEGIN IMMEDIATE');
    try {
      work();
      this.db.executeSync('COMMIT');
    } catch (error) {
      this.db.executeSync('ROLLBACK');
      throw error;
    }
  }
  initialize(): void {
    this.db.executeSync('PRAGMA foreign_keys = ON');
    this.db.executeSync('PRAGMA journal_mode = WAL');
    this.db.executeSync('PRAGMA synchronous = FULL');
    const version = Number(
      this.db.executeSync('PRAGMA user_version').rows[0]?.user_version ?? 0,
    );
    if (version > 1)
      throw new Error(
        'This database requires a newer version of FieldReports.',
      );
    if (version === 0)
      this.transaction(() => {
        this.db.executeSync(`CREATE TABLE reports (
        id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, description TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('draft','queued','uploading','retry_wait','failed','uploaded')),
        attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER, last_error TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, queued_at INTEGER)`);
        this.db.executeSync(`CREATE TABLE images (
        id TEXT NOT NULL, report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        position INTEGER NOT NULL, path TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        size INTEGER NOT NULL CHECK(size > 0 AND size <= 5242880), width INTEGER NOT NULL, height INTEGER NOT NULL, PRIMARY KEY(report_id, id))`);
        this.db.executeSync(
          'CREATE INDEX queue_due ON reports(state, next_attempt_at, queued_at)',
        );
        this.db.executeSync('PRAGMA user_version = 1');
      });
  }
  list(): Report[] {
    return this.db
      .executeSync('SELECT * FROM reports ORDER BY created_at DESC, id')
      .rows.map(row => {
        const state = row.state;
        if (!states.includes(state as UploadState))
          throw new Error('Invalid stored report state.');
        return {
          id: String(row.id),
          idempotencyKey: String(row.idempotency_key),
          description: String(row.description),
          state: state as UploadState,
          attempts: Number(row.attempts),
          nextAttemptAt:
            row.next_attempt_at === null ? null : Number(row.next_attempt_at),
          lastError: row.last_error === null ? null : String(row.last_error),
          createdAt: Number(row.created_at),
          updatedAt: Number(row.updated_at),
          queuedAt: row.queued_at === null ? null : Number(row.queued_at),
          images: this.db
            .executeSync(
              'SELECT * FROM images WHERE report_id = ? ORDER BY position',
              [String(row.id)],
            )
            .rows.map(image => ({
              id: String(image.id),
              uri: String(image.path),
              name: String(image.name),
              size: Number(image.size),
              width: Number(image.width),
              height: Number(image.height),
            })),
        };
      });
  }
  get(id: string): Report | undefined {
    return this.list().find(report => report.id === id);
  }
  saveDraft(report: Report, enqueue = false): void {
    this.transaction(() => {
      const existing = this.get(report.id);
      if (existing && existing.state !== 'draft')
        throw new Error('Only drafts can be edited.');
      if (existing && existing.idempotencyKey !== report.idempotencyKey)
        throw new Error('Report identity cannot change.');
      this.db.executeSync(
        `INSERT INTO reports (id,idempotency_key,description,state,created_at,updated_at)
        VALUES (?,?,?,'draft',?,?) ON CONFLICT(id) DO UPDATE SET description=excluded.description,updated_at=excluded.updated_at`,
        [
          report.id,
          report.idempotencyKey,
          report.description,
          report.createdAt,
          report.updatedAt,
        ],
      );
      this.db.executeSync('DELETE FROM images WHERE report_id = ?', [
        report.id,
      ]);
      report.images.forEach((image, position) =>
        this.db.executeSync(
          'INSERT INTO images (id,report_id,position,path,name,size,width,height) VALUES (?,?,?,?,?,?,?,?)',
          [
            image.id,
            report.id,
            position,
            image.uri,
            image.name,
            image.size,
            image.width,
            image.height,
          ],
        ),
      );
      if (enqueue) {
        assertTransition('draft', 'queued');
        this.db.executeSync(
          "UPDATE reports SET state='queued',queued_at=? WHERE id=?",
          [report.updatedAt, report.id],
        );
      }
    });
    this.changed();
  }
  transition(
    id: string,
    to: UploadState,
    patch: {
      attempts?: number;
      nextAttemptAt?: number | null;
      lastError?: string | null;
    } = {},
    now = Date.now(),
  ): Report {
    this.transaction(() => {
      const report = this.get(id);
      if (!report) throw new Error('Report no longer exists.');
      assertTransition(report.state, to);
      const result = this.db.executeSync(
        `UPDATE reports SET state=?,attempts=?,next_attempt_at=?,last_error=?,updated_at=?,queued_at=? WHERE id=? AND state=?`,
        [
          to,
          patch.attempts ?? report.attempts,
          patch.nextAttemptAt ?? null,
          patch.lastError ?? null,
          now,
          report.queuedAt ?? (to === 'queued' ? now : null),
          id,
          report.state,
        ],
      );
      if (result.rowsAffected !== 1)
        throw new Error('Report was modified by another worker.');
    });
    this.changed();
    return this.get(id)!;
  }
  recover(): void {
    this.db.executeSync(
      "UPDATE reports SET state='retry_wait',next_attempt_at=?,last_error='Upload interrupted; awaiting safe retry.',updated_at=? WHERE state='uploading'",
      [Date.now(), Date.now()],
    );
    this.changed();
  }
  next(now: number): Report | undefined {
    return this.list()
      .filter(
        r =>
          r.state === 'queued' ||
          (r.state === 'retry_wait' && (r.nextAttemptAt ?? 0) <= now),
      )
      .sort(
        (a, b) =>
          (a.queuedAt ?? a.createdAt) - (b.queuedAt ?? b.createdAt) ||
          a.id.localeCompare(b.id),
      )[0];
  }
  removeDraft(id: string): void {
    if (this.get(id)?.state !== 'draft')
      throw new Error('Only drafts can be deleted.');
    this.db.executeSync("DELETE FROM reports WHERE id=? AND state='draft'", [
      id,
    ]);
    this.changed();
  }
  removeUploaded(id: string): void {
    if (this.get(id)?.state !== 'uploaded')
      throw new Error('Only server-confirmed reports can be removed.');
    this.db.executeSync("DELETE FROM reports WHERE id=? AND state='uploaded'", [
      id,
    ]);
    this.changed();
  }
  purgeUploaded(): void {
    this.transaction(() =>
      this.db.executeSync("DELETE FROM reports WHERE state='uploaded'"),
    );
    this.changed();
  }
  reset(): void {
    this.transaction(() => this.db.executeSync('DELETE FROM reports'));
    this.changed();
  }
}
