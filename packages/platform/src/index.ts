import { agentPlugin } from '../../agent/src/index.js';
import { architecturePlugin } from '../../architecture/src/index.js';
import { commandInspectionPlugin, commandsPlugin } from '../../commands/src/index.js';
import { teamPlugin } from '../../team/src/index.js';
import { workflowPlugin } from '../../workflow/src/index.js';
import { timingSafeEqual } from 'node:crypto';
import { Context } from 'cordis';
import type { Client } from 'pg';
import { catalogDataPlugin, catalogPlugin } from '../../catalog/src/index.js';
import {
  hasPlanRevision,
  importedCoordinationDataPlugin,
  planExecutionDataPlugin,
  postgresTimelineChanges,
} from '../../coordination/src/index.js';
import { dataPlugin } from '../../data/src/index.js';
import { textDigest } from '../../foundation/src/index.js';
import { plannerDataPlugin } from '../../planner/src/index.js';
import { bindings } from './bindings.js';
import { connectDatabase, readSecret } from './database.js';

export { connectDatabase, readSecret } from './database.js';

interface PlatformOptions {
  database: Client;
  file: string;
  token: string;
}

function authenticateToken(token: string) {
  if (!token) throw new Error('An operator credential is required');
  const digest = Buffer.from(textDigest(token));
  return (request: Request) => {
    const credential = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    return credential !== undefined && timingSafeEqual(digest, Buffer.from(textDigest(credential)));
  };
}

function platformPlugin(database: Client, configuration: ReturnType<typeof bindings>) {
  return async (context: Context) => {
    await context.use(
      catalogPlugin(database, async ({ remote, credential }) => {
        if (credential !== undefined) throw new Error('Repository provider binding unavailable');
        const capture = configuration.capture(remote);
        if (!capture) throw new Error('Repository is not bound for isolated review');
        return capture.source.revision;
      }),
    );
    await context.use(
      dataPlugin(
        ({ scope, resource }) =>
          scope.principal === configuration.operator &&
          (scope.project === 'platform' ? resource === 'projects' : resource !== 'projects'),
      ),
    );
    await context.use(catalogDataPlugin);
    await context.use(readOnlyCommands);
    await context.use(projectReads(database, configuration));
  };
}

async function readOnlyCommands(context: Context) {
  for (const plugin of [
    teamPlugin,
    architecturePlugin,
    agentPlugin,
    workflowPlugin(),
    commandsPlugin,
  ]) {
    await context.use(plugin);
  }
}

function projectReads(database: Client, configuration: ReturnType<typeof bindings>) {
  return {
    inject: ['catalog'],
    /** Resolve project data only through the mounted catalog. */
    async apply(context: Context) {
      const resolve = ({ project, principal }: { project: string; principal: string }) =>
        context.catalog.resolve(principal, project);
      await context.use(
        plannerDataPlugin(async (scope, expected) => {
          const project = await resolve(scope);
          if (!project || !(await allowsRevision(database, project, expected))) return;
          return configuration.capture(project.remote, expected ?? project.revision);
        }),
      );
      await context.use(
        commandInspectionPlugin(async (scope) => {
          const project = await resolve(scope);
          if (!project) return;
          const capture = configuration.capture(project.remote, project.revision);
          return capture && { directory: capture.source.root, revision: capture.source.revision };
        }),
      );
      const journalProject = async (scope: Parameters<typeof resolve>[0]) =>
        (await resolve(scope))?.remote;
      await context.use(importedCoordinationDataPlugin(database, journalProject));
      await context.use(planExecutionDataPlugin(database, journalProject));
    },
  };
}

async function allowsRevision(
  database: Client,
  project: { remote: string; revision: string },
  expected?: string,
) {
  if (!expected || project.revision === expected) return true;
  return (
    /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(expected) &&
    (await hasPlanRevision(database, project.remote, expected))
  );
}

/** Compose the shared operator and project scope for isolated gateway deployments. */
export async function openPlatform(options: PlatformOptions) {
  const configuration = bindings(options.file);
  const accepts = authenticateToken(options.token);
  const context = new Context();
  await context.use(platformPlugin(options.database, configuration));
  return {
    context,
    followTimeline: postgresTimelineChanges(
      options.database,
      async (scope) => (await context.catalog.resolve(scope.principal, scope.project))?.remote,
    ),
    async authenticate(request: Request, project: string) {
      if (!accepts(request)) return undefined;
      const principal = configuration.operator;
      if (
        project === 'platform' ||
        (isProjectID(project) && (await context.catalog.resolve(principal, project)))
      )
        return { principal, project };
    },
  };
}

function isProjectID(project: string) {
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(project);
}

/** Read the explicitly enabled review deployment's trust configuration. */
export async function reviewPlatform() {
  const file = process.env.ARC_PLATFORM_BINDINGS;
  const secret = process.env.ARC_OPERATOR_TOKEN_FILE;
  if (process.env.ARC_ISOLATED_REVIEW !== '1' || !file || !secret)
    throw new Error('An isolated review and trusted bindings are required');
  const token = readSecret(secret);
  const database = await connectDatabase();
  try {
    const platform = await openPlatform({ database, file, token });
    return { ...platform, database };
  } catch (error) {
    await database.end();
    throw error;
  }
}
