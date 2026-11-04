import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** Stores typed execution entities and ordered events with a single transactional writer. */
export class ExecutionDatabase {
  private readonly db: DatabaseSync;

  /** Opens durable state for continuation; rejects incompatible historical databases. */
  constructor(path: string, readOnly = false) {
    if (!readOnly) mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path, { readOnly });
    if (!readOnly) chmodSync(path, 0o600);
    const version = this.db.prepare('PRAGMA user_version').get()?.user_version;
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    if (
      (readOnly && version !== 2) ||
      (version !== 0 && version !== 2) ||
      (version === 0 && tables.length > 0)
    ) {
      this.db.close();
      throw new Error('Execution database version cannot resume');
    }
    this.db.exec('PRAGMA busy_timeout=5000');
    if (readOnly) return;
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS entities(kind TEXT,id TEXT,data TEXT NOT NULL,PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS events(sequence INTEGER PRIMARY KEY AUTOINCREMENT,type TEXT,data TEXT,observed_at TEXT);
      PRAGMA user_version=2;`);
  }

  /** Reads a coherent SQLite snapshot without appending events or recovering work. */
  snapshot<T>(read: () => T): T {
    this.db.exec('BEGIN');
    try {
      const value = read();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /** Commits a complete domain transition and its event, rolling back all writes on error. */
  transaction<T>(type: string, data: unknown, action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      this.db
        .prepare('INSERT INTO events(type,data,observed_at) VALUES(?,?,?)')
        .run(type, JSON.stringify(data), new Date().toISOString());
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /** Loads an entity; unknown identities are errors rather than empty state. */
  get<T>(kind: string, id: string): T {
    const row = this.db.prepare('SELECT data FROM entities WHERE kind=? AND id=?').get(kind, id);
    if (!row) throw new Error(`Unknown ${kind}: ${id}`);
    return JSON.parse(String(row.data)) as T;
  }

  /** Returns entities in insertion order for deterministic scheduling. */
  all<T>(kind: string): T[] {
    return this.db
      .prepare('SELECT data FROM entities WHERE kind=? ORDER BY rowid')
      .all(kind)
      .map((row) => JSON.parse(String(row.data)) as T);
  }

  /** Creates or replaces an entity inside its caller's transaction. */
  put<T extends { id: string }>(kind: string, value: T): void {
    if (kind === 'assignment')
      this.readiness(value as unknown as import('./execution-types.js').ExecutionAssignment);
    this.db
      .prepare(
        'INSERT INTO entities VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data',
      )
      .run(kind, value.id, JSON.stringify(value));
  }

  /** Assigns a transactional FIFO position only when an assignment enters the ready queue. */
  private readiness(value: import('./execution-types.js').ExecutionAssignment): void {
    const row = this.db
      .prepare('SELECT data FROM entities WHERE kind=? AND id=?')
      .get('assignment', value.id);
    const previous = row ? JSON.parse(String(row.data)) : undefined;
    if (previous?.data.replacedBy)
      throw new Error('Replaced assignment retains immutable failure evidence');
    if (value.status !== 'ready') return;
    if (previous?.status === 'ready') {
      value.data.readyOrder = previous.data.readyOrder;
      return;
    }
    const counter = this.all<{ id: string; value: number }>('ready-clock')[0];
    const order = (counter?.value ?? 0) + 1;
    this.put('ready-clock', { id: 'project', value: order });
    value.data.readyOrder = order;
  }

  /** Reads the latest committed transition without decoding retained event or run payloads. */
  eventSequence(): number {
    return Number(this.db.prepare('SELECT MAX(sequence) AS cursor FROM events').get()?.cursor ?? 0);
  }

  /** Returns ordered events after an exclusive cursor. */
  events(after = 0) {
    return this.db
      .prepare('SELECT * FROM events WHERE sequence>? ORDER BY sequence')
      .all(after)
      .map((row) => ({
        sequence: Number(row.sequence),
        type: String(row.type),
        observed_at: String(row.observed_at),
        data: JSON.parse(String(row.data)) as Record<string, unknown>,
      }));
  }

  /** Releases the SQLite connection after all synchronous transitions finish. */
  close(): void {
    this.db.close();
  }
}
