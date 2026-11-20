import type { DatabaseSync } from 'node:sqlite';
import type { JournalEvent } from './index.js';

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
