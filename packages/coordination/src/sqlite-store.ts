import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { journalPath } from './journal-path.js';
import type { JournalBackend, JournalStore } from './journal-store.js';
import { departed, identity } from './lease.js';
import { initializeSqlite, requireNative } from './sqlite-schema.js';

/** Bind native SQLite to the verified filesystem and kernel lease. */
class NativeStore extends DatabaseSync implements JournalStore {
  /** Use the already resolved native journal path. */
  constructor(readonly key: string) {
    super(key);
  }

  /** Identify this process at the time of admission. */
  holder() {
    const lease = identity(process.pid);
    if (!lease) throw new Error('Cannot identify the project lane writer');
    return lease;
  }

  /** Verify that a previously admitted native process has exited. */
  canReclaim(lease: unknown) {
    return departed(lease);
  }

  /** Refuse effects and writes once this project has crossed the cutover fence. */
  guard() {
    requireNative(this);
  }
}

export function sqliteBackend(storage: string): JournalBackend {
  const key = (remote: string) => resolve(journalPath(storage, remote));
  return {
    key,
    open(remote) {
      const path = key(remote);
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      const database = new NativeStore(path);
      try {
        initializeSqlite(database);
        return database;
      } catch (error) {
        database.close();
        throw error;
      }
    },
  };
}
