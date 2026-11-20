import type { DatabaseSync } from 'node:sqlite';
import type { JournalEvent } from './index.js';

const descendantHistory = `
  WITH RECURSIVE descendants(task_id) AS (
    SELECT ?
    UNION
    SELECT child.task_id
    FROM runs AS child
    JOIN runs AS parent ON parent.id = child.parent_id
    JOIN descendants ON descendants.task_id = parent.task_id
  )
  SELECT events.id, events.run, runs.task_id, runs.goal_id, runs.parent_id,
    events.recorded_at, events.content
  FROM events
  JOIN runs ON runs.id = events.run
  WHERE runs.task_id IN (SELECT task_id FROM descendants)
  ORDER BY events.id
`;

/** Read all attempts of one logical task and its nested logical descendants in event order. */
export function descendantEvents(database: DatabaseSync, task: string): JournalEvent[] {
  return database.prepare(descendantHistory).all(task).map((row) => ({
    sequence: String(row.id),
    run: Number(row.run),
    taskID: String(row.task_id),
    goalID: String(row.goal_id),
    parent: row.parent_id === null ? undefined : Number(row.parent_id),
    timestamp: typeof row.recorded_at === 'string' ? row.recorded_at : null,
    observation: JSON.parse(String(row.content)) as unknown,
  }));
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
