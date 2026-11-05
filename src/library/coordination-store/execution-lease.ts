import { DatabaseSync } from 'node:sqlite';
import { chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Holds an OS-released SQLite writer lease for a repository host or application mutation. */
export class ExecutionLease {
  private readonly database: DatabaseSync;

  /** Acquires exclusive write authority and reports a caller-specific competing-owner diagnostic. */
  constructor(path: string, busyMessage = 'A host already owns project execution') {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.database = new DatabaseSync(path);
    chmodSync(path, 0o600);
    try {
      this.database.exec('PRAGMA busy_timeout=0; BEGIN IMMEDIATE');
    } catch {
      this.database.close();
      throw new Error(busyMessage);
    }
  }

  /** Releases write authority when the owning host or application mutation finishes. */
  close(): void {
    this.database.close();
  }
}
