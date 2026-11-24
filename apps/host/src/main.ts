import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { Context } from 'cordis';
import { Client } from 'pg';
import { z } from 'zod';
import { agentPlugin } from '../../../packages/agent/src/index.js';
import { Architecture, architecturePlugin } from '../../../packages/architecture/src/index.js';
import { commandsPlugin } from '../../../packages/commands/src/index.js';
import { WorkflowRequests } from '../../../packages/coordination/src/index.js';
import { verifyCheckSandbox } from '../../../packages/execution/src/index.js';
import { readSecret } from '../../../packages/platform/src/index.js';
import { hostedReady, runtimeImageSchema } from '../../../packages/foundation/src/runtime-image.js';
import { teamPlugin } from '../../../packages/team/src/index.js';
import { verifyPlatformDatabase } from '../../db/src/index.js';
import { hostedHostPlugin, serveHostedRequests } from './index.js';
import { configureGitHub } from './github-binding.js';
import { prepareCodexBinding } from './codex-binding.js';

const path = z.string().refine(isAbsolute);
const assignmentSchema = z.strictObject({
  remote: z.string().regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/),
  directory: path,
  storage: path,
  runtime: runtimeImageSchema,
  githubAppId: z.string().min(1).optional(),
  revision: z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/),
});

function assignedProject() {
  const file = process.env.ARC_HOST_ASSIGNMENT_FILE;
  const secret = process.env.ARC_HOST_DATABASE_URL_FILE;
  const worker = process.env.ARC_HOST_WORKER;
  if (process.env.ARC_ISOLATED_REVIEW !== '1' || !file || !secret || !worker)
    throw new Error('Hosted execution requires a trusted isolated assignment');
  const assignment = assignmentSchema.parse(JSON.parse(readFileSync(file, 'utf8')) as unknown);
  const { source, project } = new Architecture().capture(assignment.directory);
  if (source.remote !== assignment.remote || source.revision !== assignment.revision)
    throw new Error('Hosted checkout differs from its captured assignment');
  return { ...assignment, worker, binding: project.bindings, connectionString: readSecret(secret) };
}

async function main() {
  if (process.getuid?.() === 0)
    throw new Error('The execution Host must run as a dedicated non-root user');
  const assignment = assignedProject();
  verifyCheckSandbox(assignment.storage);
  prepareCodexBinding(assignment.directory, assignment.binding);
  const context = new Context();
  for (const dependency of [teamPlugin, architecturePlugin, agentPlugin])
    await context.use(dependency);
  await context.use(
    hostedHostPlugin(assignment.storage, {
      project: assignment.remote,
      worker: assignment.worker,
      runtime: assignment.runtime,
      github: assignment.githubAppId
        ? configureGitHub(assignment.directory, assignment.remote)
        : undefined,
      connectionString: assignment.connectionString,
    }),
  );
  await context.use(commandsPlugin);
  await serve(assignment, context.commands);
}

async function serve(
  assignment: ReturnType<typeof assignedProject>,
  commands: Context['commands'],
) {
  const database = new Client({ connectionString: assignment.connectionString });
  await database.connect();
  const controller = new AbortController();
  const stop = () => controller.abort(new Error('Hosted worker stopping'));
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    await verifyPlatformDatabase(database);
    const requests = new WorkflowRequests(database);
    // Docker starts a new init only after the previous init for this assigned container stopped.
    if (process.pid === 1)
      await requests.recover(assignment, (worker) => worker === assignment.worker);
    console.log(hostedReady);
    await serveHostedRequests(requests, commands, assignment, controller.signal);
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    await database.end();
  }
}

await main();
