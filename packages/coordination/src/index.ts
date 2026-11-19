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

const journalOwners = new WeakMap<Journal, { coordination: Coordination; remote: string }>();

const verifiedTerminal = `
  SELECT events.id, events.run, runs.task_id, runs.goal_id
  FROM events JOIN runs ON runs.id = events.run
  WHERE json_extract(content, '$.outcome.commit') = ?
    AND (
      json_extract(content, '$.outcome.kind') = 'merged'
      OR (json_extract(content, '$.outcome.kind') = 'satisfied' AND EXISTS (
        SELECT 1 FROM events reviewed WHERE reviewed.run = events.run
          AND json_extract(reviewed.content, '$.candidate.unchanged') = 1
          AND json_extract(reviewed.content, '$.verdict.kind') = 'accepted'
      ))
    )
  ORDER BY events.id DESC LIMIT 1
`;

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
    readonly taskID = digest(goal),
    readonly parent?: number,
  ) {}

  /** Expose the content identity independently of the logical task identity. */
  get goalID() {
    return digest(this.goal);
  }

  /** Append an observation in order without changing an earlier entry. */
  record(event: unknown) {
    this.database
      .prepare('INSERT INTO events (run, content) VALUES (?, ?)')
      .run(this.run, JSON.stringify(event));
  }

  /** Admit one nested session while retaining this live writer and its shared connection. */
  child(goal: string, scope: string, fresh = true): Admission | undefined {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const parent = this.database
        .prepare('SELECT active, lease FROM runs WHERE id = ?')
        .get(this.run);
      if (!parent?.active || parent.lease !== identity(process.pid))
        throw new Error('Cannot admit a child from an inactive parent or foreign writer');
      const result = claim(
        this.database,
        goal,
        fresh,
        JSON.stringify([this.taskID, scope]),
        this.run,
      );
      this.database.exec('COMMIT');
      const provenance = journalOwners.get(this);
      if (result instanceof Journal && provenance) journalOwners.set(result, provenance);
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  /** Store the terminal event and release the lane in one transaction. */
  finish(outcome: unknown) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      if (
        this.database
          .prepare('SELECT id FROM runs WHERE parent_id = ? AND active = 1')
          .get(this.run)
      )
        throw new Error('Cannot finish a session with an active child');
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

  /** Retrieve reusable research by owner from the existing append-only journal. */
  researchReports(component: string, id?: string): unknown[] {
    return this.database
      .prepare(
        `
      SELECT json_extract(content, '$.researchResult') AS report
      FROM events
      WHERE json_extract(content, '$.researchResult.component') = ?
        AND json_type(content, '$.researchResult.archive') = 'text'
        AND (? IS NULL OR json_extract(content, '$.researchResult.request.id') = ?)
      ORDER BY events.id DESC LIMIT 8
    `,
      )
      .all(component, id ?? null, id ?? null)
      .map(({ report }) => JSON.parse(String(report)));
  }

  /** Read the observed verification and delivery events for this revision. */
  verifiedRun(revision: string) {
    const terminal = this.database.prepare(verifiedTerminal).get(revision);
    if (!terminal) return;
    const events = this.database
      .prepare(
        `
      SELECT content FROM events JOIN runs ON runs.id = events.run
      WHERE task_id = ? AND events.id <= ? ORDER BY events.id
    `,
      )
      .all(terminal.task_id!, terminal.id!)
      .map(({ content }) => JSON.parse(String(content)) as unknown);
    return { id: `run:${terminal.run}`, goalID: String(terminal.goal_id), events };
  }

  /** Close the connection. An unfinished task keeps its recorded position and lane. */
  close() {
    if (this.parent === undefined) this.database.close();
  }
}

/** Open the project-local SQLite store and atomically claim its single task lane. */
export class Coordination {
  /** Use trusted application storage outside the maintained project tree. */
  constructor(private readonly storage: string) {}

  /** Claim the lane for a goal when the current staging base permits fresh admission. */
  admit(remote: string, goal: string): Admission;

  /** When given a stale checkout, admit only a goal with retained publication evidence. */
  admit(remote: string, goal: string, fresh: boolean, scope?: string): Admission | undefined;

  /** Claim the lane and recover a departed writer only for its retained publication. */
  admit(remote: string, goal: string, fresh = true, scope?: string): Admission | undefined {
    const database = this.open(remote);
    try {
      database.exec('BEGIN IMMEDIATE');
      const result = claim(database, goal, fresh, scope);
      database.exec('COMMIT');
      if (result instanceof Journal) journalOwners.set(result, { coordination: this, remote });
      else database.close();
      return result;
    } catch (error) {
      database.close();
      throw error;
    }
  }

  /** Confirm a journal was issued by this store for the same verified project remote. */
  owns(journal: Journal, remote: string): boolean {
    const provenance = journalOwners.get(journal);
    return provenance?.coordination === this && provenance.remote === remote;
  }

  /** Reuse the oldest unfinished round or capture the inventory for a new one. */
  round(remote: string, captureInventory: () => string) {
    const database = this.open(remote);
    try {
      database.exec('BEGIN IMMEDIATE');
      const previous = database
        .prepare('SELECT id, inventory FROM rounds WHERE finished = 0 ORDER BY id LIMIT 1')
        .get();
      const inventory = previous ? String(previous.inventory) : captureInventory();
      const id =
        previous?.id ??
        database.prepare('INSERT INTO rounds(inventory) VALUES (?)').run(inventory).lastInsertRowid;
      database.exec('COMMIT');
      return { id: Number(id), inventory };
    } finally {
      database.close();
    }
  }

  /** Close a round only after each goal has a completed outcome. */
  completeRound(remote: string, id: number) {
    const database = this.open(remote);
    try {
      database.prepare('UPDATE rounds SET finished = 1 WHERE id = ?').run(id);
    } finally {
      database.close();
    }
  }

  /** Read a completed logical task outcome without taking the project writer lane. */
  completedTask(remote: string, goal: string, scope: string) {
    const database = this.open(remote);
    try {
      const row = database
        .prepare(
          `
        SELECT json_extract(events.content, '$.outcome') AS outcome
        FROM events JOIN runs ON events.run = runs.id
        WHERE runs.task_id = ? AND runs.active = 0
          AND json_extract(events.content, '$.outcome.kind') IN ('merged', 'satisfied')
        ORDER BY events.id DESC LIMIT 1
      `,
        )
        .get(taskIdentity(digest(goal), scope));
      return typeof row?.outcome === 'string' ? row.outcome : undefined;
    } finally {
      database.close();
    }
  }

  /** Open the one repository store and apply additive migrations before use. */
  private open(remote: string) {
    const folder = join(this.storage, digest(remote));
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const database = new DatabaseSync(join(folder, 'tasks.sqlite'));
    try {
      this.initialize(database);
      return database;
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
      BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY, goal_id TEXT NOT NULL, task_id TEXT, goal TEXT NOT NULL,
        active INTEGER NOT NULL CHECK (active IN (0, 1)), lease TEXT,
        parent_id INTEGER REFERENCES runs(id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS rounds (
        id INTEGER PRIMARY KEY, inventory TEXT NOT NULL, finished INTEGER NOT NULL DEFAULT 0
      ) STRICT;
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY, run INTEGER NOT NULL REFERENCES runs(id), content TEXT NOT NULL
      ) STRICT;
    `);
    migrate(database);
    database.exec('COMMIT');
  }
}

type Admission = Journal | { activeGoal: string; run: number };

/** Upgrade historical task rows and replace the former single-row lane constraint atomically. */
function migrate(database: DatabaseSync) {
  const fields = database
    .prepare('PRAGMA table_info(runs)')
    .all()
    .map(({ name }) => name);
  if (!fields.includes('lease')) database.exec('ALTER TABLE runs ADD COLUMN lease TEXT');
  if (!fields.includes('task_id')) database.exec('ALTER TABLE runs ADD COLUMN task_id TEXT');
  if (!fields.includes('parent_id'))
    database.exec('ALTER TABLE runs ADD COLUMN parent_id INTEGER REFERENCES runs(id)');
  database.exec('UPDATE runs SET task_id = goal_id WHERE task_id IS NULL');
  database.exec(`
    DROP INDEX IF EXISTS one_active_goal;
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_root ON runs (active) WHERE active = 1 AND parent_id IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_child ON runs (parent_id) WHERE active = 1 AND parent_id IS NOT NULL;
  `);
}

/** Inspect prior evidence and the relevant writer in the same admission transaction. */
function claim(
  database: DatabaseSync,
  goal: string,
  fresh: boolean,
  scope?: string,
  parent?: number,
): Admission | undefined {
  const goalID = digest(goal);
  const task = taskIdentity(goalID, scope);
  const active = database
    .prepare('SELECT id, task_id, goal, lease FROM runs WHERE active = 1 AND parent_id IS ?')
    .get(parent ?? null);
  if (active && (active.task_id !== task || !departed(active.lease)))
    return { activeGoal: String(active.goal), run: Number(active.id) };
  if (!fresh && !retained(database, task)) return undefined;
  if (active) retire(database, Number(active.id));
  const prior = retained(database, task);
  const lease = identity(process.pid);
  if (!lease) throw new Error('Cannot identify the project lane writer');
  const { lastInsertRowid } = database
    .prepare(
      'INSERT INTO runs (goal_id, task_id, goal, active, lease, parent_id) VALUES (?, ?, ?, 1, ?, ?)',
    )
    .run(goalID, task, goal, lease, parent ?? null);
  const journal = new Journal(database, Number(lastInsertRowid), goal, prior, task, parent);
  if (prior) journal.record({ recovering: prior.run });
  return journal;
}

/** Preserve honest terminal observations for a departed writer and its unfinished descendants. */
function retire(database: DatabaseSync, run: number) {
  const rows = database
    .prepare(
      `
    WITH RECURSIVE descendants(id) AS (
      SELECT ? UNION ALL SELECT runs.id FROM runs JOIN descendants ON runs.parent_id = descendants.id
    ) SELECT runs.id FROM runs JOIN descendants USING(id) WHERE active = 1 ORDER BY runs.id DESC
  `,
    )
    .all(run);
  for (const { id } of rows) {
    const outcome = { kind: 'cancelled', reason: 'Task writer exited', evidence: [] };
    database
      .prepare('INSERT INTO events (run, content) VALUES (?, ?)')
      .run(id!, JSON.stringify({ outcome }));
    database.prepare('UPDATE runs SET active = 0 WHERE id = ?').run(id!);
  }
}

/** Restore ordered events from all attempts at the same logical task. */
function retained(database: DatabaseSync, task: string): RetainedRun | undefined {
  const attempt = database
    .prepare(
      `
    SELECT runs.id FROM runs
    WHERE task_id = ?
    ORDER BY EXISTS (
      SELECT 1 FROM events WHERE events.run = runs.id AND
        (json_type(content, '$.publication') = 'object' OR json_extract(content, '$.verdict.kind') = 'accepted')
    ) DESC, runs.id DESC LIMIT 1
  `,
    )
    .get(task);
  if (!attempt) return undefined;
  const events = database
    .prepare(
      'SELECT content FROM events JOIN runs ON runs.id = events.run WHERE task_id = ? ORDER BY events.id',
    )
    .all(task)
    .map(({ content }) => JSON.parse(String(content)));
  return { run: Number(attempt.id), events };
}

/** Compute the stable identity of a verified project or full goal text. */
function digest(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

/** Bind attempts to the same full goal and optional inventory scope. */
function taskIdentity(goalID: string, scope?: string) {
  return scope === undefined ? goalID : digest(JSON.stringify([scope, goalID]));
}

/** Mount the single store service using the trusted storage directory. */
export function coordinationPlugin(storage: string) {
  return (context: Context) => {
    context.provide('coordination', new Coordination(storage));
  };
}
