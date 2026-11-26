import type { Client } from 'pg';
import { z } from 'zod';

export const planReference = z.strictObject({
  execution: z.string(),
  attempt: z.string().optional(),
  revision: z.string(),
  active: z.boolean(),
  startedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type PlanReference = z.infer<typeof planReference>;

const plan = `
  WITH captured AS (
    SELECT DISTINCT ON (r.task_id) r.task_id AS execution,
           COALESCE(e.content::jsonb#>>'{planningExecution,revision}', e.content::jsonb->>'revision') AS revision
    FROM arcnexus_coordination.events e JOIN arcnexus_coordination.runs r
      ON r.project=e.project AND r.id=e.run
    WHERE r.project=$1 AND r.task_id IS NOT NULL AND ($2::text IS NULL OR r.task_id=$2)
      AND COALESCE(e.content::jsonb#>>'{planningExecution,revision}', e.content::jsonb->>'revision') IS NOT NULL
      AND (e.content::jsonb ? 'planningExecution' OR e.content::jsonb ? 'plannerProposal')
    ORDER BY r.task_id,r.id DESC,e.id DESC
  )
  SELECT captured.*, max(r.id)::text AS attempt, bool_or(r.active = 1) AS active,
         min(e.recorded_at) AS "startedAt", max(e.recorded_at) AS "updatedAt"
  FROM captured JOIN arcnexus_coordination.runs r
    ON r.project=$1 AND r.task_id=captured.execution
  LEFT JOIN arcnexus_coordination.events e ON e.project=r.project AND e.run=r.id
  GROUP BY captured.execution,captured.revision
  ORDER BY max(r.id) DESC
  LIMIT $3
`;

/** Resolve the latest Plan, or one retained execution by identity. */
export async function readPlanReference(database: Client, project: string, execution?: string) {
  const { rows } = await database.query<PlanReference>(plan, [project, execution ?? null, 1]);
  return rows[0];
}

/** List each retained Plan execution once, including across resumed attempts. */
export async function listPlanReferences(database: Client, project: string) {
  return (await database.query<PlanReference>(plan, [project, null, null])).rows;
}

/** Recognize an approved guide revision retained by a recorded planning execution. */
export async function hasPlanRevision(database: Client, project: string, revision: string) {
  const { rows } = await database.query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM arcnexus_coordination.events e
       WHERE project=$1 AND (
         content::jsonb#>>'{planningExecution,revision}'=$2 OR
         (content::jsonb ? 'plannerProposal' AND content::jsonb->>'revision'=$2)
         OR (content::jsonb#>>'{outcome,kind}'='merged' AND content::jsonb#>>'{outcome,commit}'=$2
           AND EXISTS (SELECT 1 FROM arcnexus_coordination.events p
             WHERE p.project=e.project AND p.run=e.run
               AND (p.content::jsonb ? 'planningExecution' OR p.content::jsonb ? 'plannerProposal')))
       )
     ) AS allowed`,
    [project, revision],
  );
  return rows[0]?.allowed ?? false;
}
