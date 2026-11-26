import { createHash } from 'node:crypto';
import type { Context } from 'cordis';
import { sqliteBackend } from './sqlite-store.js';
import type { JournalBackend, JournalStore } from './journal-store.js';
import { journalPath } from './journal-path.js';
import {
  completedRefinementRounds,
  descendantEvents,
  researchReports,
  verifiedTerminal,
  recentFindings,
  readTimeline,
  readTimelineFile,
  type TimelineWindow,
} from './journal-queries.js';
import type { JournalEvent, RetainedRun } from './journal-types.js';
export { RunMeasurements } from './measurements.js';
export type { TimelineSlice, TimelineWindow } from './journal-queries.js';
export type { JournalEvent, RetainedRun } from './journal-types.js';
export {
  coordinationDataPlugin,
  importedCoordinationDataPlugin,
  type ResolveJournalProject,
} from './data.js';
export { coordinationMigration } from './postgres/schema.js';
export { journalNotificationMigration, postgresTimelineChanges } from './postgres/follow.js';
export { importSqliteJournal } from './postgres/import.js';
export { readImportedTimeline } from './postgres/read-timeline.js';
export { hasPlanRevision } from './postgres/plan-records.js';
export { planExecutionDataPlugin } from './postgres/plan-data.js';
export { reconcileHosted } from './postgres/reconcile.js';
export {
  documentationDiscoveryMigration,
  retireDocumentationDiscoveryMigration,
} from './postgres/documentation-schema.js';
export { hostedCoordinationMigration } from './postgres/hosted-schema.js';
export { hostSessionMigration } from './postgres/session-schema.js';
export { workflowRuntimeMigration } from './postgres/workflow-runtime-schema.js';
export { workflowReceiptsMigration } from './postgres/workflow-receipts-schema.js';
export {
  workflowRequestsMigration,
  workflowDocumentationMigration,
} from './postgres/workflow-requests-schema.js';
export {
  operationEvidenceDataPlugin,
  readOperationEvidence,
} from './postgres/operation-evidence.js';
export { WorkflowRequests, type WorkflowGate } from './postgres/workflow-requests.js';
export { hostedProjectCoordination, type HostedProject } from './postgres/session-store.js';
export { cutoverSqliteJournal } from './postgres/cutover.js';
export { timelineChanges, type TimelineChanges } from './timeline-feed.js';

declare module 'cordis' {
  interface Context {
    coordination: Coordination;
  }
}

/** Store the ordered observations for a single admitted task. */
export class Journal {
  /** Bind this writer to the database row claimed at admission. */
  constructor(
    private readonly database: JournalStore,
    readonly run: number,
    readonly goal: string,
    readonly retained?: RetainedRun,
    readonly taskID = digest(goal),
    readonly parent?: number,
  ) {}

  /** Compare the writer against the selected backend's exact project binding. */
  belongsTo(key: string) {
    return this.database.key === key;
  }

  /** Signal the hosted execution when its dedicated writer connection is lost. */
  get signal() {
    return this.database.signal;
  }

  /** Confirm the live writer before beginning protected Host effects. */
  assertWriter() {
    this.database.guard(this.run);
  }

  /** Expose the content identity independently of the logical task identity. */
  get goalID() {
    return digest(this.goal);
  }

  /** Append only while the native backend still owns this project. */
  record(event: unknown) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.guard(this.run);
      const frame = append(this.database, this, event);
      this.database.exec('COMMIT');
      return frame;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  /** Admit one nested session while retaining this live writer and its shared connection. */
  child(goal: string, scope: string, fresh = true): Admission | undefined {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.guard(this.run);
      const parent = this.database
        .prepare('SELECT active, lease FROM runs WHERE id = ?')
        .get(this.run);
      if (!parent?.active || parent.lease !== this.database.holder())
        throw new Error('Cannot admit a child from an inactive parent or foreign writer');
      const result = claim(this.database, goal, fresh, JSON.stringify([this.taskID, scope]), {
        parent: this.run,
      });
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  /** Read the canonical retained stream for a child phase without opening a second writer or store. */
  childEvents(goal: string, scope: string): readonly unknown[] {
    const task = taskIdentity(digest(goal), JSON.stringify([this.taskID, scope]));
    return retained(this.database, task)?.events ?? [];
  }

  /** Read a child's complete canonical history and every logical descendant across attempts. */
  childTimeline(goal: string, scope: string): JournalEvent[] {
    const task = taskIdentity(digest(goal), JSON.stringify([this.taskID, scope]));
    return descendantEvents(this.database, task);
  }

  /** Store the terminal event and release the lane in one transaction. */
  finish(outcome: unknown) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.guard(this.run);
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
      const event = append(this.database, this, { outcome });
      this.database.exec('COMMIT');
      return event;
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

  /** Render complete task history with durable identities, including honest unknown historical timestamps. */
  timeline(): JournalEvent[] {
    return this.database
      .prepare(
        `
      SELECT events.id, events.run, runs.task_id, runs.goal_id, runs.parent_id,
        events.recorded_at, events.content
      FROM events JOIN runs ON events.run = runs.id
      WHERE runs.task_id = ? ORDER BY events.id
    `,
      )
      .all(this.taskID)
      .map((row) => ({
        sequence: String(row.id),
        run: Number(row.run),
        taskID: String(row.task_id),
        goalID: String(row.goal_id),
        parent: row.parent_id === null ? undefined : Number(row.parent_id),
        timestamp: typeof row.recorded_at === 'string' ? row.recorded_at : null,
        observation: JSON.parse(String(row.content)) as unknown,
      }));
  }

  /** Authorize a retained artifact by its original host event in this verified project's store. */
  artifactRecorded(path: string) {
    return Boolean(
      this.database
        .prepare("SELECT 1 FROM events WHERE json_extract(content, '$.artifact') = ? LIMIT 1")
        .get(path),
    );
  }

  /** Read recent observed failures and repairs for architectural assessment without creating another store. */
  findings() {
    return this.database
      .prepare(recentFindings)
      .all()
      .map(({ id, run, goal_id, content }) => ({
        id,
        run,
        goal: goal_id,
        observation: JSON.parse(String(content)) as unknown,
      }));
  }

  /** Read every completed refinement round across invocations in this verified project's event order. */
  completedRounds(): JournalEvent[] {
    return completedRefinementRounds(this.database);
  }

  /** Retrieve reusable research by owner from the existing append-only journal. */
  researchReports(component: string, id?: string): unknown[] {
    return researchReports(this.database, component, id);
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

/** Manage the native SQLite lane for a verified project. */
export class Coordination {
  private readonly backend: JournalBackend;

  /** Bind the native or hosted backend selected by the trusted composition. */
  constructor(private readonly storage: string | JournalBackend) {
    this.backend = typeof storage === 'string' ? sqliteBackend(storage) : storage;
  }

  /** Verify a supplied parent against this project's actual canonical journal file. */
  owns(remote: string, journal: Journal) {
    return journal.belongsTo(this.backend.key(remote));
  }

  /** Replay the project journal without creating, migrating or acquiring a writer. */
  readTaskTimeline(remote: string, task: string, window: TimelineWindow = {}) {
    if (typeof this.storage === 'string')
      return readTimelineFile(journalPath(this.storage, remote), task, window);
    const database = this.backend.open(remote);
    try {
      return readTimeline(database, task, window);
    } finally {
      database.close();
    }
  }

  /** Claim the lane for a goal when the current staging base permits fresh admission. */
  admit(remote: string, goal: string): Admission;

  /** When given a stale checkout, admit only a goal with retained publication evidence. */
  admit(
    remote: string,
    goal: string,
    fresh: boolean,
    scope?: string,
    cycle?: boolean,
  ): Admission | undefined;

  /** Claim the lane and recover a departed writer only for its retained publication. */
  admit(
    remote: string,
    goal: string,
    fresh = true,
    scope?: string,
    cycle = false,
  ): Admission | undefined {
    const database = this.backend.open(remote);
    try {
      database.exec('BEGIN IMMEDIATE');
      database.guard();
      const result = claim(database, goal, fresh, scope, { cycle });
      database.exec('COMMIT');
      if (!(result instanceof Journal)) database.close();
      return result;
    } catch (error) {
      database.close();
      throw error;
    }
  }

  /** Reuse the oldest unfinished round in its namespace or capture a new inventory. */
  round(remote: string, captureInventory: () => string, namespace = 'task') {
    const database = this.backend.open(remote);
    try {
      database.exec('BEGIN IMMEDIATE');
      database.guard();
      const previous = database
        .prepare(
          'SELECT id, inventory FROM rounds WHERE finished = 0 AND namespace = ? ORDER BY id LIMIT 1',
        )
        .get(namespace);
      const inventory = previous ? String(previous.inventory) : captureInventory();
      const id =
        previous?.id ??
        database
          .prepare('INSERT INTO rounds(inventory, namespace) VALUES (?, ?)')
          .run(inventory, namespace).lastInsertRowid;
      database.exec('COMMIT');
      return { id: Number(id), inventory };
    } finally {
      database.close();
    }
  }

  /** Close a round only after each goal has a completed outcome. */
  completeRound(remote: string, id: number) {
    const database = this.backend.open(remote);
    try {
      database.exec('BEGIN IMMEDIATE');
      database.guard();
      database.prepare('UPDATE rounds SET finished = 1 WHERE id = ?').run(id);
      database.exec('COMMIT');
    } finally {
      database.close();
    }
  }

  /** Read a completed logical task outcome without taking the project writer lane. */
  completedTask(remote: string, goal: string, scope: string) {
    const database = this.backend.open(remote);
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
}

function append(database: JournalStore, journal: Journal, event: unknown) {
  const timestamp = new Date().toISOString();
  const content = JSON.stringify(event);
  const result = database
    .prepare('INSERT INTO events (run, content, recorded_at) VALUES (?, ?, ?)')
    .run(journal.run, content, timestamp);
  return {
    sequence: String(result.lastInsertRowid),
    run: journal.run,
    taskID: journal.taskID,
    goalID: journal.goalID,
    parent: journal.parent,
    timestamp,
    observation: JSON.parse(content) as unknown,
  } satisfies JournalEvent;
}

type Admission = Journal | { activeGoal: string; run: number };
type ClaimOptions = { parent?: number; cycle?: boolean };
const activeRun =
  'SELECT id, task_id, goal, lease FROM runs WHERE active = 1 AND parent_id IS NOT DISTINCT FROM ?';

/** Inspect prior evidence and the relevant writer in the same admission transaction. */
function claim(
  database: JournalStore,
  goal: string,
  fresh: boolean,
  scope?: string,
  { parent, cycle = false }: ClaimOptions = {},
): Admission | undefined {
  const goalID = digest(goal);
  const key = taskIdentity(goalID, scope);
  const task = cycle ? cycleIdentity(database, key) : key;
  const active = database.prepare(activeRun).get(parent ?? null);
  if (active && (active.task_id !== task || !database.canReclaim(active.lease)))
    return { activeGoal: String(active.goal), run: Number(active.id) };
  if (!fresh && !retained(database, task)) return undefined;
  if (active) retire(database, Number(active.id));
  const prior = retained(database, task);
  const lease = database.holder();
  const { lastInsertRowid } = database
    .prepare(
      'INSERT INTO runs (goal_id, task_id, goal, active, lease, parent_id) VALUES (?, ?, ?, 1, ?, ?)',
    )
    .run(goalID, task, goal, lease, parent ?? null);
  const journal = new Journal(database, Number(lastInsertRowid), goal, prior, task, parent);
  if (cycle) append(database, journal, { cycle: key });
  if (prior) append(database, journal, { recovering: prior.run });
  return journal;
}

/** Resume an unfinished foreground cycle, or give the next completed assessment a fresh identity. */
function cycleIdentity(database: JournalStore, key: string) {
  const row = database
    .prepare(
      `
    SELECT runs.id, runs.task_id, (
      SELECT json_extract(terminal.content, '$.outcome') FROM events terminal
      WHERE terminal.run = runs.id AND json_type(terminal.content, '$.outcome') = 'object'
      ORDER BY terminal.id DESC LIMIT 1
    ) AS outcome
    FROM runs JOIN events marker ON marker.run = runs.id
    WHERE runs.parent_id IS NULL AND json_extract(marker.content, '$.cycle') = ?
    ORDER BY runs.id DESC LIMIT 1
  `,
    )
    .get(key);
  if (!row) return key;
  const outcome =
    typeof row.outcome === 'string' ? (JSON.parse(row.outcome) as { kind: string }) : undefined;
  const completed =
    outcome?.kind === 'planned' || outcome?.kind === 'merged' || outcome?.kind === 'refined';
  return completed ? digest(JSON.stringify([key, Number(row.id)])) : String(row.task_id);
}

/** Preserve honest terminal observations for a departed writer and its unfinished descendants. */
function retire(database: JournalStore, run: number) {
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
      .prepare('INSERT INTO events (run, content, recorded_at) VALUES (?, ?, ?)')
      .run(id!, JSON.stringify({ outcome }), new Date().toISOString());
    database.prepare('UPDATE runs SET active = 0 WHERE id = ?').run(id!);
  }
}

/** Restore ordered events from all attempts at the same logical task. */
function retained(database: JournalStore, task: string): RetainedRun | undefined {
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

function digest(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function taskIdentity(goalID: string, scope?: string) {
  return scope === undefined ? goalID : digest(JSON.stringify([scope, goalID]));
}

export function coordinationPlugin(storage: string) {
  return (context: Context) => {
    context.provide('coordination', new Coordination(storage));
  };
}
