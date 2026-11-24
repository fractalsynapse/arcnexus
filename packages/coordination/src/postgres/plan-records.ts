import type { Client } from 'pg';

export type PlanReference = { execution: string; revision: string; active: boolean };

const plan = `
  SELECT r.task_id AS execution,r.active = 1 AS active,
         COALESCE(e.content::jsonb#>>'{planningExecution,revision}', e.content::jsonb->>'revision') AS revision
  FROM arcnexus_coordination.events e JOIN arcnexus_coordination.runs r
    ON r.project=e.project AND r.id=e.run
  WHERE r.project=$1 AND r.task_id IS NOT NULL AND ($2::text IS NULL OR r.task_id=$2)
    AND COALESCE(e.content::jsonb#>>'{planningExecution,revision}', e.content::jsonb->>'revision') IS NOT NULL
    AND (e.content::jsonb ? 'planningExecution' OR e.content::jsonb ? 'plannerProposal')
  ORDER BY r.id DESC,e.id DESC FETCH FIRST ROW ONLY
`;

/** Resolve the newest matching Plan attempt from its retained planning observation. */
export async function readPlanReference(database: Client, project: string, execution?: string) {
  const { rows } = await database.query<PlanReference>(plan, [project, execution ?? null]);
  return rows[0];
}

/** Recognize an approved guide revision retained by a recorded planning execution. */
export async function hasPlanRevision(database: Client, project: string, revision: string) {
  const { rows } = await database.query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM arcnexus_coordination.events
       WHERE project=$1 AND (
         content::jsonb#>>'{planningExecution,revision}'=$2 OR
         (content::jsonb ? 'plannerProposal' AND content::jsonb->>'revision'=$2)
       )
     ) AS allowed`,
    [project, revision],
  );
  return rows[0]?.allowed ?? false;
}
