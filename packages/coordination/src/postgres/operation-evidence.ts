import type { Context } from 'cordis';
import type { Client } from 'pg';
import { z } from 'zod';
import { dataOperation, type DataScope } from '../../../data/src/index.js';
import { readHostEvidence, type EvidenceRoots } from './host-evidence.js';
import { planContextSchema, readPlanContext } from './plan-context.js';
import { executionJournal } from './retired-discovery.js';

const references = `
  WITH RECURSIVE selected AS (${executionJournal}), tasks(id) AS (
    SELECT $2::text
    UNION
    SELECT child.task_id FROM arcnexus_coordination.runs child
    JOIN arcnexus_coordination.runs parent ON parent.project=child.project AND parent.id=child.parent_id
    JOIN tasks ON tasks.id=parent.task_id WHERE child.project=(SELECT project FROM selected)
  ), requested AS (
    SELECT e.run, e.content::jsonb#>>'{operation,call}' AS call
    FROM arcnexus_coordination.events e JOIN arcnexus_coordination.runs r
      ON r.project=e.project AND r.id=e.run
    JOIN tasks ON tasks.id=r.task_id
    WHERE e.project=(SELECT project FROM selected) AND e.id=$3::bigint
  ), operations AS (
    SELECT e.id,e.run,e.content::jsonb#>>'{operation,source}' AS source
    FROM arcnexus_coordination.events e JOIN requested r ON e.run=r.run
    WHERE e.project=(SELECT project FROM selected) AND (
      e.id=$3::bigint OR (r.call IS NOT NULL AND e.content::jsonb#>>'{operation,call}'=r.call)
    )
  )
  SELECT source FROM operations
  WHERE EXISTS (
    SELECT 1 FROM arcnexus_coordination.events e
    WHERE e.project=(SELECT project FROM selected) AND e.run=operations.run AND e.content::jsonb->>'artifact'=source
  )
  ORDER BY operations.id
`;

/** Read exact tool observations only through a recorded execution event and approved mounts. */
export async function readOperationEvidence(
  database: Client,
  remote: string,
  execution: string,
  sequence: string,
  roots: EvidenceRoots,
) {
  const { rows } = await database.query<{ source: string }>(references, [
    remote,
    execution,
    sequence,
  ]);
  if (!rows.length) throw new Error('Operation evidence is not retained in this execution');
  return {
    entries: await readHostEvidence(
      roots,
      rows.map(({ source }) => source),
    ),
  };
}

type Resolve = (scope: DataScope) => Promise<{ remote: string; roots: EvidenceRoots } | undefined>;

export function operationEvidenceDataPlugin(database: Client, resolve: Resolve) {
  return {
    inject: ['data'],
    /** Keep bulk evidence out of timeline responses and authorize it on demand. */
    apply(context: Context) {
      const operations = evidenceOperations(database, resolve);
      context.effect(() => context.data.register({ id: 'operation-evidence', operations }));
    },
  };
}

function evidenceOperations(database: Client, resolve: Resolve) {
  const projectFor = async (scope: DataScope) => {
    const project = await resolve(scope);
    if (!project) throw new Error('This project has no mounted Host evidence');
    return project;
  };
  return {
    read: dataOperation(
      z.strictObject({ execution: z.string(), sequence: z.string().regex(/^[1-9][0-9]*$/) }),
      z.strictObject({ entries: z.array(z.unknown()) }),
      async (scope, { execution, sequence }) => {
        const { remote, roots } = await projectFor(scope);
        return readOperationEvidence(database, remote, execution, sequence, roots);
      },
    ),
    context: dataOperation(
      z.strictObject({ execution: z.string() }),
      planContextSchema,
      async (scope, { execution }) => {
        const { remote, roots } = await projectFor(scope);
        return readPlanContext(database, remote, execution, roots);
      },
    ),
  };
}
