import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Context } from 'cordis';
import { departed, identity } from './lease.js';

declare module 'cordis' {
  interface Context {
    coordination: Coordination;
  }
}

export interface RetainedRun {
  run: number;
  events: readonly unknown[];
}

/** Store the ordered observations for a single admitted task. */
export class Journal {
  /** Bind this writer to the database row claimed at admission. */
  constructor(
    private readonly database: DatabaseSync,
    readonly run: number,
    readonly goal: string,
    readonly retained?: RetainedRun,
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

  /** Claim the lane for a goal when the current staging base permits fresh admission. */
  admit(remote: string, goal: string): Admission;

  /** When given a stale checkout, admit only a goal with retained publication evidence. */
  admit(remote: string, goal: string, fresh: boolean): Admission | undefined;

  /** Claim the lane and recover a departed writer only for its retained publication. */
  admit(remote: string, goal: string, fresh = true): Admission | undefined {
    const folder = join(this.storage, digest(remote));
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const database = new DatabaseSync(join(folder, 'tasks.sqlite'));
    try {
      this.initialize(database);
      database.exec('BEGIN IMMEDIATE');
      const claim = this.claim(database, goal, fresh);
      database.exec('COMMIT');
      if (!(claim instanceof Journal)) database.close();
      return claim;
    } catch (error) {
      database.close();
      throw error;
    }
  }

  /** Inspect prior evidence and the current writer in the same admission transaction. */
  private claim(database: DatabaseSync, goal: string, fresh: boolean): Admission | undefined {
    const goalID = digest(goal);
    const prior = retained(database, goalID);
    const active = database
      .prepare('SELECT id, goal_id, goal, lease FROM runs WHERE active = 1')
      .get();
    if (active && !reclaimable(database, active, goalID, prior))
      return { activeGoal: String(active.goal), run: Number(active.id) };
    if (!fresh && !prior) return undefined;
    if (active) {
      database.prepare('UPDATE runs SET active = 0 WHERE id = ?').run(active.id!);
      const outcome = { kind: 'cancelled', reason: 'Publication writer exited', evidence: [] };
      database
        .prepare('INSERT INTO events (run, content) VALUES (?, ?)')
        .run(active.id!, JSON.stringify({ outcome }));
    }
    const lease = identity(process.pid);
    if (!lease) throw new Error('Cannot identify the project lane writer');
    const { lastInsertRowid } = database
      .prepare('INSERT INTO runs (goal_id, goal, active, lease) VALUES (?, ?, 1, ?)')
      .run(goalID, goal, lease);
    const journal = new Journal(database, Number(lastInsertRowid), goal, prior);
    if (prior) journal.record({ recovering: prior.run });
    return journal;
  }

  /** Create storage constraints before the first admission. */
  private initialize(database: DatabaseSync) {
    database.exec(`
      PRAGMA busy_timeout = 2000;
      PRAGMA foreign_keys = ON;
      BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY, goal_id TEXT NOT NULL, goal TEXT NOT NULL,
        active INTEGER NOT NULL CHECK (active IN (0, 1)), lease TEXT
      ) STRICT;
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_goal ON runs (active) WHERE active = 1;
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY, run INTEGER NOT NULL REFERENCES runs(id), content TEXT NOT NULL
      ) STRICT;
    `);
    if (
      !database
        .prepare('PRAGMA table_info(runs)')
        .all()
        .some(({ name }) => name === 'lease')
    )
      database.exec('ALTER TABLE runs ADD COLUMN lease TEXT');
    database.exec('COMMIT');
  }
}

type Admission = Journal | { activeGoal: string; run: number };

/** Confirm both writer death and the link to the exact retained publication. */
function reclaimable(
  database: DatabaseSync,
  active: Record<string, unknown>,
  goal: string,
  prior?: RetainedRun,
) {
  if (active.goal_id !== goal || !prior || !departed(active.lease)) return false;
  if (prior.run === active.id) return true;
  return Boolean(
    database
      .prepare(
        "SELECT 1 FROM events WHERE run = ? AND json_extract(content, '$.recovering') = ? LIMIT 1",
      )
      .get(Number(active.id), prior.run),
  );
}

/** Find the publication source for this exact goal, preserving the accepting verdict. */
function retained(database: DatabaseSync, goal: string): RetainedRun | undefined {
  const row = database
    .prepare(
      `
    SELECT runs.id FROM runs JOIN events ON events.run = runs.id
    WHERE runs.goal_id = ? AND (
      json_type(events.content, '$.publication') = 'object' OR
      json_extract(events.content, '$.verdict.kind') = 'accepted'
    )
    ORDER BY runs.id DESC LIMIT 1
  `,
    )
    .get(goal);
  if (!row) return undefined;
  const run = Number(row.id);
  const events = database
    .prepare('SELECT content FROM events WHERE run = ? ORDER BY id')
    .all(run)
    .map(({ content }) => JSON.parse(String(content)));
  return { run, events };
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
