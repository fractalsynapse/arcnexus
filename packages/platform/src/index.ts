import { agentPlugin } from '../../agent/src/index.js';
import { architecturePlugin } from '../../architecture/src/index.js';
import {
  commandInspectionPlugin,
  commandsPlugin,
  hostedCommandsDataPlugin,
} from '../../commands/src/index.js';
import { teamPlugin } from '../../team/src/index.js';
import { workflowPlugin } from '../../workflow/src/index.js';
import { timingSafeEqual } from 'node:crypto';
import { Context } from 'cordis';
import type { Client } from 'pg';
import { admittedProvider } from '../../capacity/src/index.js';
import { catalogDataPlugin, catalogPlugin } from '../../catalog/src/index.js';
import {
  WorkflowRequests,
  hasPlanRevision,
  importedCoordinationDataPlugin,
  planExecutionDataPlugin,
  operationEvidenceDataPlugin,
  postgresTimelineChanges,
  type TimelineChanges,
} from '../../coordination/src/index.js';
import { dataPlugin, type DataAccess, type DataScope } from '../../data/src/index.js';
import { textDigest } from '../../foundation/src/index.js';
import { plannerDataPlugin } from '../../planner/src/index.js';
import { hostAssignments } from './host-assignments.js';
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
      catalogPlugin(database, ({ remote, credential }) => configuration.verify(remote, credential)),
    );
    await context.use(scopedResources(database, configuration));
  };
}

function scopedResources(database: Client, configuration: Configuration) {
  return {
    inject: ['catalog'],
    /** Register resource owners against the trusted catalog service. */
    async apply(context: Context) {
      const catalog = context.catalog;
      const project = (scope: DataScope) => catalog.resolve(scope.principal, scope.project);
      await context.use(
        dataPlugin((access) => authorized(access, configuration, project, database)),
      );
      await context.use(catalogDataPlugin);
      await context.use(readOnlyCommands);
      await projectResources(context, database, configuration, project);
    },
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

type Configuration = ReturnType<typeof bindings>;
type Project = (scope: DataScope) => ReturnType<Context['catalog']['resolve']>;

async function authorized(
  { scope, resource, operation }: DataAccess,
  configuration: Configuration,
  project: Project,
  database: Client,
) {
  if (scope.principal !== configuration.operator) return false;
  if (scope.project === 'platform') return resource === 'projects';
  if (resource === 'projects') return false;
  if (resource !== 'workflow-requests' && resource !== 'operation-evidence') return true;
  const resolved = await project(scope);
  if (!resolved) return false;
  if (resource === 'workflow-requests') {
    if (!configuration.hosted(resolved.remote)) return false;
    if (operation !== 'create') return true;
    const provider = configuration.provider(resolved.remote);
    return provider ? admittedProvider(database, scope.principal, provider) : false;
  }
  return Boolean(configuration.evidence(resolved.remote));
}

async function projectResources(
  context: Context,
  database: Client,
  configuration: Configuration,
  project: Project,
) {
  const journal = async (scope: DataScope) => (await project(scope))?.remote;
  await mountProjectReads(context, database, configuration, project);
  await context.use(importedCoordinationDataPlugin(database, journal));
  await context.use(planExecutionDataPlugin(database, journal));
  await context.use(
    operationEvidenceDataPlugin(database, async (scope) => {
      const remote = await journal(scope);
      const roots = remote && configuration.evidence(remote);
      return roots && remote ? { remote, roots } : undefined;
    }),
  );
  await context.use(
    hostedCommandsDataPlugin(new WorkflowRequests(database), async (scope) => {
      const target = await project(scope);
      return target && configuration.hosted(target.remote) ? target : undefined;
    }),
  );
}

async function mountProjectReads(
  context: Context,
  database: Client,
  configuration: Configuration,
  project: Project,
) {
  await context.use(
    plannerDataPlugin(async (scope, expected) => {
      const resolved = await project(scope);
      if (!resolved || !(await allowsRevision(database, resolved, expected))) return;
      return configuration.capture(resolved.remote, expected ?? resolved.revision);
    }),
  );
  await context.use(
    commandInspectionPlugin(async (scope) => {
      const resolved = await project(scope);
      if (!resolved) return;
      const capture = configuration.capture(resolved.remote, resolved.revision);
      return capture && { directory: capture.source.root, revision: capture.source.revision };
    }),
  );
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
  const requests = new WorkflowRequests(options.database);
  const journalProject = async (scope: DataScope) =>
    (await context.catalog.resolve(scope.principal, scope.project))?.remote;
  const followCommands: TimelineChanges = async (scope, signal) => {
    const remote = await journalProject(scope);
    if (!remote) throw new Error('Project unavailable');
    return requests.watchReceipts(remote, signal);
  };
  return {
    context,
    hostAssignments: hostAssignments(context.catalog, requests, configuration),
    followTimeline: postgresTimelineChanges(options.database, journalProject),
    followCommands,
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
