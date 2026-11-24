import type { Client } from 'pg';
import type { TimelineSlice, TimelineWindow } from '../journal-queries.js';
import type { JournalEvent } from '../journal-types.js';

const retained = `
  WITH RECURSIVE descendants(task_id) AS (
    SELECT $2::text
    UNION
    SELECT child.task_id
    FROM arcnexus_coordination.runs AS child
    JOIN arcnexus_coordination.runs AS parent
      ON child.project = parent.project AND child.parent_id = parent.id
    JOIN descendants ON descendants.task_id = parent.task_id
    WHERE child.project = $1
  ), retained AS (
    SELECT events.id, events.run, runs.task_id, runs.goal_id, runs.parent_id,
           events.recorded_at, events.content
    FROM arcnexus_coordination.events AS events
    JOIN arcnexus_coordination.runs AS runs
      ON events.project = runs.project AND events.run = runs.id
    JOIN descendants ON descendants.task_id = runs.task_id
    WHERE events.project = $1
  ), bounds AS (
    SELECT
      COALESCE($3::bigint, 0) AS low,
      COALESCE($4::bigint, (SELECT max(id) FROM retained)) AS high,
      ($3::bigint IS NULL OR EXISTS (SELECT 1 FROM retained WHERE id = $3::bigint))
      AND ($4::bigint IS NULL OR EXISTS (SELECT 1 FROM retained WHERE id = $4::bigint)) AS valid
  )
`;

const windowRows =
  retained +
  `
  SELECT bounds.high AS through, (bounds.valid AND bounds.high >= bounds.low) AS valid,
         event.id, event.run, event.task_id, event.goal_id, event.parent_id,
         event.content, event.recorded_at
  FROM bounds LEFT JOIN retained AS event ON event.id > bounds.low AND event.id <= bounds.high
  ORDER BY event.id
`;

interface Row {
  through: string | null;
  valid: boolean | null;
  id: string | null;
  run: string;
  task_id: string;
  goal_id: string;
  parent_id: string | null;
  content: string;
  recorded_at: string | null;
}

function event(row: Row): JournalEvent {
  return {
    sequence: row.id!,
    run: Number(row.run),
    taskID: row.task_id,
    goalID: row.goal_id,
    parent: row.parent_id === null ? undefined : Number(row.parent_id),
    timestamp: row.recorded_at,
    observation: JSON.parse(row.content) as unknown,
  };
}

/** Replay a verified import using one PostgreSQL statement snapshot and unchanged cursors. */
export async function readImportedTimeline(
  database: Client,
  remote: string,
  execution: string,
  { after, through }: TimelineWindow = {},
): Promise<TimelineSlice> {
  const { rows } = await database.query<Row>(windowRows, [
    remote,
    execution,
    after ?? null,
    through ?? null,
  ]);
  const first = rows[0];
  if (first?.valid === false) throw new Error('Timeline cursor is unavailable in this execution');
  if (!first?.through) return { events: [] };
  return { through: first.through, events: rows.filter((row) => row.id !== null).map(event) };
}
