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
  admit(remote: string, goal: string, fresh: boolean, scope?: string): Admission | undefined;

  /** Claim the lane and recover a departed writer only for its retained publication. */
  admit(remote: string, goal: string, fresh = true, scope?: string): Admission | undefined {
    const database = this.open(remote);
    try {
      database.exec('BEGIN IMMEDIATE');
      const claim = this.claim(database, goal, fresh, scope);
      database.exec('COMMIT');
      if (!(claim instanceof Journal)) database.close();
      return claim;
    } catch (error) {
      database.close();
      throw error;
    }
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

  /** Inspect prior evidence and the current writer in the same admission transaction. */
  private claim(database: DatabaseSync, goal: string, fresh: boolean, scope?: string) {
    const goalID = digest(goal);
    const task = taskIdentity(goalID, scope);
    const prior = retained(database, task);
    const active = database
      .prepare('SELECT id, task_id, goal, lease FROM runs WHERE active = 1')
      .get();
    if (active && (active.task_id !== task || !departed(active.lease)))
      return { activeGoal: String(active.goal), run: Number(active.id) };
    if (!fresh && !prior) return undefined;
    if (active) this.retire(database, Number(active.id));
    const lease = identity(process.pid);
    if (!lease) throw new Error('Cannot identify the project lane writer');
    const { lastInsertRowid } = database
      .prepare('INSERT INTO runs (goal_id, task_id, goal, active, lease) VALUES (?, ?, ?, 1, ?)')
      .run(goalID, task, goal, lease);
    const journal = new Journal(database, Number(lastInsertRowid), goal, prior, task);
    if (prior) journal.record({ recovering: prior.run });
    return journal;
  }

  /** Retain the departed writer's actual outcome before admitting its replacement. */
  private retire(database: DatabaseSync, run: number) {
    database.prepare('UPDATE runs SET active = 0 WHERE id = ?').run(run);
    const outcome = { kind: 'cancelled', reason: 'Task writer exited', evidence: [] };
    database
      .prepare('INSERT INTO events (run, content) VALUES (?, ?)')
      .run(run, JSON.stringify({ outcome }));
  }

  /** Create storage constraints before the first admission. */
  private initialize(database: DatabaseSync) {
    database.exec(`
      PRAGMA busy_timeout = 2000;
      PRAGMA foreign_keys = ON;
      BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY, goal_id TEXT NOT NULL, task_id TEXT, goal TEXT NOT NULL,
        active INTEGER NOT NULL CHECK (active IN (0, 1)), lease TEXT
      ) STRICT;
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_goal ON runs (active) WHERE active = 1;
      CREATE TABLE IF NOT EXISTS rounds (
        id INTEGER PRIMARY KEY, inventory TEXT NOT NULL, finished INTEGER NOT NULL DEFAULT 0
      ) STRICT;
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY, run INTEGER NOT NULL REFERENCES runs(id), content TEXT NOT NULL
      ) STRICT;
    `);
    const fields = database
      .prepare('PRAGMA table_info(runs)')
      .all()
      .map(({ name }) => name);
    if (!fields.includes('lease')) database.exec('ALTER TABLE runs ADD COLUMN lease TEXT');
    if (!fields.includes('task_id')) database.exec('ALTER TABLE runs ADD COLUMN task_id TEXT');
    database.exec('UPDATE runs SET task_id = goal_id WHERE task_id IS NULL');
    database.exec('COMMIT');
  }
}

type Admission = Journal | { activeGoal: string; run: number };

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

export interface RevisionSnapshot {
  plan: { milestones: { id: string; [key: string]: unknown }[]; [key: string]: unknown };
  position: { completed: number; activities: Record<string, number> };
  observations: readonly unknown[];
}

/** Capture the latest committed plan and position with all immutable observations. */
export function revisionSnapshot(observations: readonly unknown[]): RevisionSnapshot {
  const retained = structuredClone(observations);
  const refresh = retained.findLastIndex(
    (event) => isRecord(event) && 'plannerRefresh' in event,
  );
  const active = retained.slice(refresh + 1);
  const plan = active.findLast(
    (event): event is Record<string, unknown> => isRecord(event) && isRecord(event.plan),
  );
  const position = active.findLast(
    (event): event is Record<string, unknown> => isRecord(event) && isRecord(event.position),
  );
  if (!plan) throw new Error('Revision requires an accepted plan');
  return {
    plan: structuredClone(plan.plan) as RevisionSnapshot['plan'],
    position: structuredClone(position?.position ?? { completed: 0, activities: {} }) as
      RevisionSnapshot['position'],
    observations: retained,
  };
}

/** Identify the object-shaped journal observations used by revision snapshots. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Mount the single store service using the trusted storage directory. */
export function coordinationPlugin(storage: string) {
  return (context: Context) => {
    context.provide('coordination', new Coordination(storage));
  };
}
