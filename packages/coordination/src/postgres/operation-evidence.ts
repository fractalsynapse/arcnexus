import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';
import type { Context } from 'cordis';
import type { Client } from 'pg';
import { z } from 'zod';
import { dataOperation, type DataScope } from '../../../data/src/index.js';

const references = `
  WITH RECURSIVE tasks(id) AS (
    SELECT $2::text
    UNION
    SELECT child.task_id FROM arcnexus_coordination.runs child
    JOIN arcnexus_coordination.runs parent ON parent.project=child.project AND parent.id=child.parent_id
    JOIN tasks ON tasks.id=parent.task_id WHERE child.project=$1
  ), requested AS (
    SELECT e.run, e.content::jsonb#>>'{operation,call}' AS call
    FROM arcnexus_coordination.events e JOIN arcnexus_coordination.runs r
      ON r.project=e.project AND r.id=e.run
    JOIN tasks ON tasks.id=r.task_id
    WHERE e.project=$1 AND e.id=$3::bigint
  ), operations AS (
    SELECT e.id,e.run,e.content::jsonb#>>'{operation,source}' AS source
    FROM arcnexus_coordination.events e JOIN requested r ON e.run=r.run
    WHERE e.project=$1 AND (
      e.id=$3::bigint OR (r.call IS NOT NULL AND e.content::jsonb#>>'{operation,call}'=r.call)
    )
  )
  SELECT source FROM operations
  WHERE EXISTS (
    SELECT 1 FROM arcnexus_coordination.events e
    WHERE e.project=$1 AND e.run=operations.run AND e.content::jsonb->>'artifact'=source
  )
  ORDER BY operations.id
`;

async function readArtifact(root: string, path: string) {
  const location = relative(root, path);
  if (
    !isAbsolute(path) ||
    !location ||
    location === '..' ||
    location.startsWith('..' + sep) ||
    (await realpath(path)) !== path
  )
    throw new Error('Recorded operation evidence is outside the mounted Host storage');
  const file = await lstat(path);
  if (!file.isFile() || file.nlink !== 1)
    throw new Error('Recorded operation evidence is unavailable');
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

/** Read exact tool observations only through a recorded execution event and a trusted evidence root. */
export async function readOperationEvidence(
  database: Client,
  remote: string,
  execution: string,
  sequence: string,
  root: string,
) {
  const { rows } = await database.query<{ source: string }>(references, [
    remote,
    execution,
    sequence,
  ]);
  if (!rows.length) throw new Error('Operation evidence is not retained in this execution');
  const directory = await realpath(root);
  if (directory !== root) throw new Error('The evidence root is an alias');
  const entries = await Promise.all(rows.map(({ source }) => readArtifact(directory, source)));
  return { entries };
}

type Resolve = (scope: DataScope) => Promise<{ remote: string; root: string } | undefined>;

export function operationEvidenceDataPlugin(database: Client, resolve: Resolve) {
  return {
    inject: ['data'],
    /** Keep bulk tool data out of the timeline and authorize it only on demand. */
    apply(context: Context) {
      const read = dataOperation(
        z.strictObject({ execution: z.string(), sequence: z.string().regex(/^[1-9][0-9]*$/) }),
        z.strictObject({ entries: z.array(z.unknown()) }),
        async (scope, input) => {
          const project = await resolve(scope);
          if (!project) throw new Error('This project has no mounted Host evidence');
          return readOperationEvidence(
            database,
            project.remote,
            input.execution,
            input.sequence,
            project.root,
          );
        },
      );
      context.effect(() =>
        context.data.register({ id: 'operation-evidence', operations: { read } }),
      );
    },
  };
}
