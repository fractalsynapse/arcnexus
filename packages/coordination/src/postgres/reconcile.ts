import type { Client } from 'pg';

import { lockHostedProject } from './session-schema.js';

const store = 'arcnexus_coordination';
const retire = `
  WITH RECURSIVE previous(id) AS (
    SELECT id FROM ${store}.runs
    WHERE project=$1 AND id=$2 AND lease=$3 AND active=1 AND parent_id IS NULL
    UNION ALL
    SELECT child.id FROM ${store}.runs child JOIN previous parent ON child.parent_id=parent.id
    WHERE child.project=$1 AND child.active=1
  ), retired AS (
    UPDATE ${store}.runs SET active=0
    WHERE project=$1 AND id IN (SELECT id FROM previous) AND active=1 RETURNING id
  ), head AS (
    SELECT COALESCE(MAX(id),0) AS sequence FROM ${store}.events WHERE project=$1
  )
  INSERT INTO ${store}.events (project,id,run,content,recorded_at)
  SELECT $1,head.sequence + row_number() OVER (ORDER BY retired.id DESC),retired.id,$4,$5
  FROM retired CROSS JOIN head
`;

function worker(lease: string) {
  try {
    const holder = (JSON.parse(lease) as { worker?: unknown } | null)?.worker;
    if (typeof holder === 'string') return holder;
  } catch {
    return lease;
  }
  return lease;
}

/** Keep interrupted positions available until trusted Host reconciliation proves the owner stopped. */
export async function reconcileHosted(
  database: Client,
  project: string,
  confirmStopped: (owner: string) => boolean | Promise<boolean>,
) {
  const current = await database.query<{ id: string; lease: string | null }>(
    `SELECT id,lease FROM ${store}.runs
     WHERE project=$1 AND active=1 AND parent_id IS NULL
       AND NOT documentation_only
       AND EXISTS (SELECT 1 FROM ${store}.hosted_projects WHERE project=$1)`,
    [project],
  );
  const run = current.rows[0];
  if (!run?.lease || !(await confirmStopped(worker(run.lease)))) return false;
  return retireConfirmed(database, project, run.id, run.lease);
}

async function retireConfirmed(database: Client, project: string, id: string, lease: string) {
  await database.query('BEGIN');
  try {
    await database.query(lockHostedProject, [project]);
    const retired = await retireWriter(database, project, id, lease, 'Hosted writer exited');
    await database.query('COMMIT');
    return retired;
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  }
}

/** Retire one proven-departed writer in the caller's hosted project transaction. */
export async function retireWriter(
  database: Client,
  project: string,
  id: string,
  lease: string,
  reason: string,
) {
  const outcome = { kind: 'cancelled', reason, evidence: [] };
  const result = await database.query(retire, [
    project,
    id,
    lease,
    JSON.stringify({ outcome }),
    new Date().toISOString(),
  ]);
  return Boolean(result.rowCount);
}
