import type { Client } from 'pg';
import { journalSchema } from './schema.js';

const namespace = 'retired-documentation:';

// The release workflow still authenticates against the canonical remote. This internal key is read-only.
export const projectJournals = `($1, '${namespace}' || $1)`;

/** Resolve an execution inside its authorized project before reading its existing sequence IDs. */
export const executionJournal = `
  SELECT project FROM arcnexus_coordination.runs
  WHERE project IN ${projectJournals} AND task_id=$2
  ORDER BY (project=$1) DESC
  FETCH FIRST ROW ONLY
`;

/** Move retired records within the cutover transaction without changing any event or run identity. */
export async function preserveRetiredDiscovery(database: Client, remote: string) {
  const target = namespace + remote;
  const retired = 'project=$1 AND documentation_only AND active=0';
  const runs = journalSchema.runs.columns;
  const events = journalSchema.events.columns;
  await database.query(
    `INSERT INTO arcnexus_coordination.runs (project,${runs},documentation_only)
     SELECT $2,${runs},true FROM arcnexus_coordination.runs WHERE ${retired}`,
    [remote, target],
  );
  await database.query(
    `WITH archived AS (
      DELETE FROM arcnexus_coordination.events WHERE project=$1 AND run IN (
        SELECT id FROM arcnexus_coordination.runs WHERE ${retired}
      ) RETURNING ${events}
    ) INSERT INTO arcnexus_coordination.events (project,${events}) SELECT $2,${events} FROM archived`,
    [remote, target],
  );
  await database.query(`DELETE FROM arcnexus_coordination.runs WHERE ${retired}`, [remote]);
}
