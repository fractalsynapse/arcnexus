import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Context } from 'cordis';

declare module 'cordis' {
  interface Context {
    coordination: Coordination;
  }
}

/** Store the ordered observations for a single admitted task. */
export class Journal {
  /** Bind this writer to the database row claimed at admission. */
  constructor(
    private readonly database: DatabaseSync,
    readonly run: number,
    readonly goal: string,
  ) {}

  /** Append an observation in order without changing an earlier entry. */
  record(event: unknown) {
    this.database
      .prepare('INSERT INTO events (run, content) VALUES (?, ?)')
      .run(this.run, JSON.stringify(event));
  }

  /** Store the terminal event and release the lane in one transaction. */
  finish(outcome: unknown) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const updated = this.database
        .prepare('UPDATE runs SET active = 0 WHERE id = ? AND active = 1')
        .run(this.run);
      if (!updated.changes) throw new Error('This task already has a terminal outcome');
      this.record({ outcome });
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  /** Expose retained observations in write order. */
  events(): unknown[] {
    return this.database
      .prepare('SELECT content FROM events WHERE run = ? ORDER BY id')
      .all(this.run)
      .map(({ content }) => JSON.parse(String(content)));
  }

  /** Close the connection. An unfinished task keeps its recorded position and lane. */
  close() {
    this.database.close();
  }
}

/** Open the project-local SQLite store and atomically claim its single task lane. */
export class Coordination {
  /** Use trusted application storage outside the maintained project tree. */
  constructor(private readonly storage: string) {}

  /** Admit one goal or return the existing goal and its retained run identity. */
  admit(remote: string, goal: string): Journal | { activeGoal: string; run: number } {
    const folder = join(this.storage, digest(remote));
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const database = new DatabaseSync(join(folder, 'tasks.sqlite'));
    try {
      this.initialize(database);
      database.exec('BEGIN IMMEDIATE');
      const active = database.prepare('SELECT id, goal FROM runs WHERE active = 1').get();
      if (active) {
        database.exec('COMMIT');
        database.close();
        return { activeGoal: String(active.goal), run: Number(active.id) };
      }
      const { lastInsertRowid } = database
        .prepare('INSERT INTO runs (goal_id, goal, active) VALUES (?, ?, 1)')
        .run(digest(goal), goal);
      database.exec('COMMIT');
      return new Journal(database, Number(lastInsertRowid), goal);
    } catch (error) {
      database.close();
      throw error;
    }
  }

  /** Create storage constraints before the first admission. */
  private initialize(database: DatabaseSync) {
    database.exec(`
      PRAGMA busy_timeout = 2000;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY, goal_id TEXT NOT NULL, goal TEXT NOT NULL,
        active INTEGER NOT NULL CHECK (active IN (0, 1))
      ) STRICT;
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_goal ON runs (active) WHERE active = 1;
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY, run INTEGER NOT NULL REFERENCES runs(id), content TEXT NOT NULL
      ) STRICT;
    `);
  }
}

/** Compute the stable identity of a verified project or full goal text. */
function digest(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

/** Mount the single store service using the trusted storage directory. */
export function coordinationPlugin(storage: string) {
  return (context: Context) => {
    context.provide('coordination', new Coordination(storage));
  };
}
