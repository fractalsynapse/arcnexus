import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

export interface PortfolioRepository {
  id: string;
  location: string;
  managed: boolean;
}

export interface PortfolioRegistration {
  id: string;
  kind: 'platform' | 'package';
  repositoryId: string;
  definitionId: string;
  revision: number;
  active: boolean;
}

/** Stores locations and registrations while architectural facts remain in committed definitions. */
export class PortfolioStore {
  private readonly db?: DatabaseSync;

  /** Opens absent volumes read-only without creating them; writes initialize a versioned private database. */
  constructor(
    path: string,
    private readonly writable = false,
  ) {
    if (!writable && !existsSync(path)) return;
    if (writable) mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path, { readOnly: !writable });
    const version = this.db.prepare('PRAGMA user_version').get()?.user_version;
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    if ((version !== 0 && version !== 1) || (version === 0 && tables.length)) {
      this.db.close();
      throw new Error('Unsupported portfolio database');
    }
    if (writable) {
      chmodSync(path, 0o600);
      this.db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
      this.db.exec(`CREATE TABLE IF NOT EXISTS repositories(id TEXT PRIMARY KEY,data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS registrations(kind TEXT,id TEXT,data TEXT NOT NULL,PRIMARY KEY(kind,id));
        CREATE TABLE IF NOT EXISTS events(sequence INTEGER PRIMARY KEY,type TEXT,data TEXT);
        PRAGMA user_version=1;`);
    }
  }

  /** Returns stable repository locations without filesystem-dependent identifiers. */
  repositories(): PortfolioRepository[] {
    return (this.db?.prepare('SELECT data FROM repositories ORDER BY id').all() ?? []).map((row) =>
      JSON.parse(String(row.data)),
    );
  }

  /** Includes tombstones only for mutation/recovery; ordinary callers receive active registrations. */
  registrations(includeRemoved = false): PortfolioRegistration[] {
    return (this.db?.prepare('SELECT data FROM registrations ORDER BY kind,id').all() ?? [])
      .map((row) => JSON.parse(String(row.data)) as PortfolioRegistration)
      .filter((row) => includeRemoved || row.active);
  }

  /** Serializes registration changes and records their event in the same durable transaction. */
  transaction<T>(type: string, action: () => T): T {
    if (!this.writable || !this.db) throw new Error('Portfolio is read-only');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      this.db
        .prepare('INSERT INTO events(type,data) VALUES(?,?)')
        .run(type, JSON.stringify(result));
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /** Registers a previously resolved storage location inside a caller-owned transaction. */
  repository(value: PortfolioRepository): void {
    if (!this.writable) throw new Error('Portfolio is read-only');
    this.db!.prepare('INSERT INTO repositories VALUES(?,?)').run(value.id, JSON.stringify(value));
  }

  /** Persists registration revision/tombstone without deleting source or historical evidence. */
  registration(value: PortfolioRegistration): void {
    if (!this.writable) throw new Error('Portfolio is read-only');
    this.db!.prepare(
      `INSERT INTO registrations VALUES(?,?,?)
      ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data`,
    ).run(value.kind, value.id, JSON.stringify(value));
  }

  /** Detects unfinished execution in an existing repository store without recovering or mutating it. */
  static activeExecution(path: string): boolean {
    if (!existsSync(path)) return false;
    const database = new DatabaseSync(path, { readOnly: true });
    try {
      return database
        .prepare("SELECT data FROM entities WHERE kind='run'")
        .all()
        .some((row) => {
          const run = JSON.parse(String(row.data));
          return !['completed', 'cancelled', 'failed', 'stopped'].includes(run.status);
        });
    } finally {
      database.close();
    }
  }

  /** Releases SQLite resources without changing lifecycle state. */
  close(): void {
    this.db?.close();
  }
}
