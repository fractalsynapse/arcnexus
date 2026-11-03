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

export interface RepositoryMaterialization {
  id: string;
  remote: string;
  location: string;
  evidence: string;
  status: 'pending' | 'ready' | 'registered' | 'needs_attention';
  base?: string;
  error?: string;
}

/** Stores locations and registrations while architectural facts remain in committed definitions. */
export class PortfolioStore {
  private readonly db?: DatabaseSync;

  private version = 0;

  /** Opens absent volumes read-only without creating them; writes initialize a versioned private database. */
  constructor(
    path: string,
    private readonly writable = false,
  ) {
    if (!writable && !existsSync(path)) return;
    if (writable) mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path, { readOnly: !writable });
    try {
      this.db.exec('PRAGMA busy_timeout=5000');
      this.version = this.inspect();
      if (writable) this.initialize(path);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  /** Inspects version and tables in one read snapshot so initialization cannot produce mixed metadata. */
  private inspect(): number {
    this.db!.exec('BEGIN');
    try {
      const version = Number(this.db!.prepare('PRAGMA user_version').get()?.user_version);
      const tables = this.db!.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      if (![0, 1, 2].includes(version) || (version === 0 && tables.length))
        throw new Error('Unsupported portfolio database');
      return version;
    } finally {
      this.db!.exec('ROLLBACK');
    }
  }

  /** Upgrades registry storage transactionally without altering retained source or run databases. */
  private initialize(path: string): void {
    chmodSync(path, 0o600);
    this.db!.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    this.db!.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS repositories(id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS registrations(kind TEXT,id TEXT,data TEXT NOT NULL,PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS events(sequence INTEGER PRIMARY KEY,type TEXT,data TEXT);
      CREATE TABLE IF NOT EXISTS materializations(remote TEXT PRIMARY KEY,data TEXT NOT NULL);
      PRAGMA user_version=2;
      COMMIT;`);
    this.version = 2;
  }

  /** Reads clone intents, including failures, without initializing an older read-only registry. */
  materializations(): RepositoryMaterialization[] {
    if (this.version < 2) return [];
    return this.db!.prepare('SELECT data FROM materializations ORDER BY remote')
      .all()
      .map((row) => JSON.parse(String(row.data)));
  }

  /** Records clone state inside the caller's registration or intent transaction. */
  materialization(value: RepositoryMaterialization): void {
    if (!this.writable) throw new Error('Portfolio is read-only');
    this.db!.prepare(
      `INSERT INTO materializations VALUES(?,?)
      ON CONFLICT(remote) DO UPDATE SET data=excluded.data`,
    ).run(value.remote, JSON.stringify(value));
  }

  /** Returns stable repository locations without filesystem-dependent identifiers. */
  repositories(): PortfolioRepository[] {
    if (this.version === 0) return [];
    return (this.db?.prepare('SELECT data FROM repositories ORDER BY id').all() ?? []).map((row) =>
      JSON.parse(String(row.data)),
    );
  }

  /** Includes tombstones only for mutation/recovery; ordinary callers receive active registrations. */
  registrations(includeRemoved = false): PortfolioRegistration[] {
    if (this.version === 0) return [];
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
        .run(type, JSON.stringify(result ?? null));
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
