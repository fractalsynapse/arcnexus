import type { Client } from 'pg';

const store = 'arcnexus_coordination';
const finish = `
  WITH retained AS (
    SELECT (outcome->>'round')::bigint AS round
    FROM ${store}.workflow_requests WHERE project=$1 AND worker=$2 AND id=$3
      AND state='running' AND request->>'command'='task_run' AND NOT request ? 'goal'
      AND outcome->>'kind'='round' AND outcome->'completed'='true'::jsonb
  ), closed AS (
    UPDATE ${store}.rounds SET finished=1 WHERE project=$1 AND namespace='task'
      AND id=(SELECT round FROM retained) RETURNING id
  )
  UPDATE ${store}.workflow_requests SET state='finished', worker=NULL, reply=NULL, gate=NULL
  WHERE project=$1 AND worker=$2 AND id=$3 AND state='running' AND EXISTS(SELECT 1 FROM closed)
`;

/** Finalize a stopped Host's exact recorded round without opening another inventory. */
export async function finishRetainedRound(
  database: Client,
  owner: { remote: string; worker: string },
  id: string,
) {
  const result = await database.query(finish, [owner.remote, owner.worker, id]);
  return Boolean(result.rowCount);
}
