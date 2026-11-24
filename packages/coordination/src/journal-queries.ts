import { statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { JournalEvent } from './journal-types.js';

const retained = `
  WITH RECURSIVE descendants(task_id) AS (
    SELECT ?
    UNION
    SELECT child.task_id
    FROM runs AS child
    JOIN runs AS parent ON parent.id = child.parent_id
    JOIN descendants ON descendants.task_id = parent.task_id
  ), retained AS (
    SELECT events.id, events.run, runs.task_id, runs.goal_id, runs.parent_id,
      events.recorded_at, events.content
    FROM events
    JOIN runs ON runs.id = events.run
    WHERE runs.task_id IN (SELECT task_id FROM descendants)
  )
`;

export interface TimelineWindow {
  after?: string;
  through?: string;
}

export interface TimelineSlice {
  events: JournalEvent[];
  through?: string;
}

/** Read all attempts of one logical task and its nested logical descendants in event order. */
export function descendantEvents(
  database: DatabaseSync,
  task: string,
  { after, through }: TimelineWindow = {},
): JournalEvent[] {
  return database
    .prepare(
      `
      ${retained}
      SELECT CAST(id AS TEXT) AS sequence, run, task_id, goal_id, parent_id, recorded_at, content
      FROM retained
      WHERE (:after IS NULL OR id > :after) AND (:through IS NULL OR id <= :through)
      ORDER BY id
    `,
    )
    .all({ after: after ?? null, through: through ?? null }, task)
    .map((row) => ({
      sequence: String(row.sequence),
      run: Number(row.run),
      taskID: String(row.task_id),
      goalID: String(row.goal_id),
      parent: row.parent_id === null ? undefined : Number(row.parent_id),
      timestamp: typeof row.recorded_at === 'string' ? row.recorded_at : null,
      observation: JSON.parse(String(row.content)) as unknown,
    }));
}

/** Inspect an existing journal without creating or migrating stores. */
export function readTimelineFile(
  path: string,
  task: string,
  window: TimelineWindow,
): TimelineSlice {
  try {
    statSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (window.after !== undefined || window.through !== undefined)
      throw new Error('Timeline cursor is unavailable in this execution', { cause: error });
    return { events: [] };
  }
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    return readTimeline(database, task, window);
  } finally {
    database.close();
  }
}

/** Pin one consistent read view when resolving and replaying a cursor window. */
function readTimeline(database: DatabaseSync, task: string, window: TimelineWindow): TimelineSlice {
  database.exec('BEGIN');
  try {
    for (const cursor of [window.after, window.through]) {
      if (cursor !== undefined) verifyCursor(database, task, cursor);
    }
    if (window.after && window.through && BigInt(window.after) > BigInt(window.through))
      throw new Error('Timeline cursor window is reversed');
    const end = window.through ?? newestSequence(database, task);
    if (!end) return { events: [] };
    return {
      events: descendantEvents(database, task, { after: window.after, through: end }),
      through: end,
    };
  } finally {
    database.exec('ROLLBACK');
  }
}

/** Resolve a cursor only within the selected logical task and its retained descendants. */
function verifyCursor(database: DatabaseSync, task: string, cursor: string) {
  if (
    !/^[1-9][0-9]*$/.test(cursor) ||
    !database.prepare(`${retained} SELECT 1 FROM retained WHERE id = ?`).get(task, cursor)
  )
    throw new Error('Timeline cursor is unavailable in this execution');
}

function newestSequence(database: DatabaseSync, task: string) {
  const row = database
    .prepare(`${retained} SELECT CAST(MAX(id) AS TEXT) AS sequence FROM retained`)
    .get(task);
  return typeof row?.sequence === 'string' ? row.sequence : undefined;
}

export const verifiedTerminal = `
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

export const recentFindings = `
  SELECT incident.id, incident.run, runs.goal_id, incident.content
  FROM events AS incident JOIN runs ON runs.id = incident.run
  WHERE (
    json_extract(incident.content, '$.outcome.kind') IN ('failed', 'blocked', 'cancelled')
    OR json_type(incident.content, '$.repair') = 'object'
    OR json_type(incident.content, '$.stewardRepair') = 'object'
  ) AND NOT EXISTS (
    SELECT 1 FROM events AS gate
    WHERE gate.run = incident.run
      AND json_extract(gate.content, '$.clarification.question') =
          json_extract(incident.content, '$.outcome.reason')
      AND json_type(gate.content, '$.clarification.answer') IS NULL
  )
  ORDER BY incident.id DESC
`;

export function researchReports(database: DatabaseSync, component: string, id?: string): unknown[] {
  return database
    .prepare(
      `
      SELECT json_extract(content, '$.researchResult') AS report
      FROM events
      WHERE json_extract(content, '$.researchResult.component') = ?
        AND json_type(content, '$.researchResult.archive') = 'text'
        AND (? IS NULL OR json_extract(content, '$.researchResult.request.id') = ?)
      ORDER BY events.id DESC
    `,
    )
    .all(component, id ?? null, id ?? null)
    .map(({ report }) => JSON.parse(String(report)));
}

export function completedRefinementRounds(database: DatabaseSync): JournalEvent[] {
  return database
    .prepare(
      `
      SELECT events.id, events.run, runs.task_id, runs.goal_id, runs.parent_id,
        events.recorded_at, events.content
      FROM events JOIN runs ON runs.id = events.run
      WHERE json_type(events.content, '$.completedRound') = 'object'
      ORDER BY events.id
    `,
    )
    .all()
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
