import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Context } from 'cordis';
import { Client } from 'pg';
import { agentPlugin } from '../../../../packages/agent/src/index.js';
import { architecturePlugin } from '../../../../packages/architecture/src/index.js';
import { teamPlugin } from '../../../../packages/team/src/index.js';
import {
  commandsPlugin,
  dispatchWorkflow,
  hostedCommandsDataPlugin,
} from '../../../../packages/commands/src/index.js';
import {
  Coordination,
  hostedProjectCoordination,
  readImportedTimeline,
  WorkflowRequests,
} from '../../../../packages/coordination/src/index.js';
import { RoundConsumptionFixture } from '../../../../packages/execution/tests/fixtures/round-consumption.js';
import { dataPlugin } from '../../../../packages/data/src/index.js';
import { apiPlugin } from '../../../api/src/index.js';
import { databaseSetupPlugin } from '../../../db/src/index.js';
import { operatorMcpPlugin } from '../../../mcp/src/index.js';
import { hostedHostPlugin, runHostedRequest } from '../../src/index.js';

export const suite = { owner: 'host-app', level: 'integration', tags: ['postgresql'] } as const;

const connectionString = process.env.ARC_TEST_DATABASE_URL;
const command = { command: 'refine', rounds: '1' } as const;

async function fixture(t: TestContext) {
  const project = new RoundConsumptionFixture(
    t,
    'https://github.com/example/' + randomUUID() + '.git',
  );
  const { remote, revision } = project.architecture.capture(project.root).source;
  const sqlite = new Coordination(project.storage);
  const seed = sqlite.admit(remote, 'Fixture admission');
  assert.ok('record' in seed);
  seed.finish({ kind: 'satisfied' });
  seed.close();
  const database = new Client({ connectionString });
  await database.connect();
  t.after(() => database.end());
  const setup = new Context();
  await setup.use(databaseSetupPlugin(database));
  await setup.databaseSetup.migrate();
  await setup.databaseSetup.cutover(project.storage, remote);
  return { database, remote, revision, project };
}

async function commands(project: RoundConsumptionFixture, remote: string) {
  const host = new Context();
  for (const plugin of [teamPlugin, architecturePlugin, agentPlugin]) await host.use(plugin);
  await host.use(
    hostedHostPlugin(project.storage, {
      project: remote,
      worker: 'isolated-host',
      connectionString: connectionString!,
    }),
  );
  await host.use(commandsPlugin);
  return host.commands;
}

test(
  'the actual Host resumes a held refinement through its PostgreSQL journal',
  { skip: !connectionString },
  async (t) => {
    const { database, remote, project } = await fixture(t);
    const signal = new AbortController().signal;
    const first = await commands(project, remote);
    const held = await dispatchWorkflow(first, project.root, command, { progress() {} }, signal);
    assert.equal(held.kind, 'blocked');
    const second = await commands(project, remote);
    const questions: string[] = [];
    const complete = await dispatchWorkflow(
      second,
      project.root,
      command,
      {
        progress() {},
        async answer(question: string) {
          questions.push(question);
          return 'Use the existing verified baseline.';
        },
      },
      signal,
    );
    assert.equal(complete.kind, 'planned', JSON.stringify(complete));
    assert.match(JSON.stringify(questions), /planner/);
    await verifyResumedRefinement(database, remote);
  },
);

async function verifyResumedRefinement(database: Client, remote: string) {
  const { rows } = await database.query<{ task_id: string }>(
    'SELECT DISTINCT task_id FROM arcnexus_coordination.runs WHERE project=$1 AND goal=$2',
    [remote, 'Continuous refinement'],
  );
  assert.equal(rows.length, 1);
  const replay = await readImportedTimeline(database, remote, rows[0]!.task_id);
  assert.ok(
    replay.events.some(({ observation }) =>
      JSON.stringify(observation).includes('Use the existing verified baseline.'),
    ),
  );
}

test(
  'REST admits one command and MCP answers its exact retained approval',
  { skip: !connectionString },
  async (t) => {
    const { database, remote, project, revision } = await fixture(t);
    const requests = new WorkflowRequests(database);
    const { api, mcp } = await gateway(t, requests, remote, revision);
    await verifyContract(api);
    const id = randomUUID();
    const call = commandClient(api);
    await verifyAdmission(call, id);
    const worker = await commands(project, remote);
    const signal = new AbortController().signal;
    const owner = { remote, revision, directory: project.root, worker: 'isolated-host' };
    await runHostedRequest(requests, worker, owner, signal);
    const held = await (await call('/' + id)).json();
    assert.equal(held.state, 'waiting');
    assert.equal(
      (await call('/' + id + '/answer', 'POST', { gate: 'different', answer: 'approve' })).status,
      409,
    );
    const response = await mcp.callTool({
      name: 'answer_workflow',
      arguments: { id, gate: held.gate.id, answer: 'Use the verified baseline.' },
    });
    assert.equal(response.isError, undefined, JSON.stringify(response));
    await runHostedRequest(requests, worker, owner, signal);
    const completed = await (await call('/' + id)).json();
    assert.equal(completed.state, 'finished');
    assert.equal(completed.outcome.kind, 'planned');
    assert.equal(completed.execution, held.execution);
  },
);

type Api = (request: Request) => Promise<Response>;

async function verifyContract(api: Api) {
  const spec = await (
    await api(new Request('http://arc.local/projects/fixture/openapi.json'))
  ).json();
  assert.ok(spec.paths['/projects/{project}/commands'].post.responses['202']);
  const approval = spec.paths['/projects/{project}/commands/{id}/answer'].post;
  assert.deepEqual(approval.requestBody.content['application/json'].schema.required, [
    'gate',
    'answer',
  ]);
}

function commandClient(api: Api) {
  return (path: string, method = 'GET', body?: object) =>
    api(
      new Request('http://arc.local/projects/fixture/commands' + path, {
        method,
        body: body && JSON.stringify(body),
      }),
    );
}

async function verifyAdmission(call: ReturnType<typeof commandClient>, id: string) {
  assert.equal((await call('', 'POST', { id, request: { command: 'task_plan' } })).status, 202);
  assert.equal(
    (await call('', 'POST', { id: randomUUID(), request: { command: 'task_plan' } })).status,
    409,
  );
}

test(
  'a stopped Host retains its queued decision and marks its old journal inactive',
  { skip: !connectionString },
  async (t) => {
    const { database, remote, revision } = await fixture(t);
    const owner = { remote, revision, worker: 'departed-host' };
    const caller = { remote, principal: 'isolated-operator' };
    const requests = new WorkflowRequests(database);
    const id = randomUUID();
    await requests.submit(caller, id, { command: 'task_plan' }, revision);
    assert.equal((await requests.claim(owner))?.id, id);
    const coordination = hostedProjectCoordination({
      project: remote,
      worker: owner.worker,
      connectionString: connectionString!,
    });
    const departed = coordination.admit(remote, 'Retained work');
    assert.ok('record' in departed);
    departed.record({ message: 'Committed before disconnect' });
    departed.close();
    assert.equal(await requests.recover(owner, () => false), false);
    assert.equal(await requests.recover(owner, (worker) => worker === owner.worker), true);
    assert.equal((await requests.claim({ remote, revision, worker: 'replacement' }))?.id, id);
    const replay = await readImportedTimeline(database, remote, departed.taskID);
    assert.match(JSON.stringify(replay.events), /Committed before disconnect/);
    assert.match(JSON.stringify(replay.events), /Hosted writer exited/);
  },
);

async function gateway(
  t: TestContext,
  requests: WorkflowRequests,
  remote: string,
  revision: string,
) {
  const context = new Context();
  await context.use(dataPlugin(({ scope }) => scope.project === 'fixture'));
  await context.use(hostedCommandsDataPlugin(requests, async () => ({ remote, revision })));
  await context.use(
    apiPlugin((_request, project) => ({ project, principal: 'isolated-operator' })),
  );
  await context.use(operatorMcpPlugin);
  const server = context.operatorMcp({ project: 'fixture', principal: 'isolated-operator' });
  const client = new McpClient({ name: 'isolated-operator', version: '1' });
  const [caller, transport] = InMemoryTransport.createLinkedPair();
  await server.connect(transport);
  await client.connect(caller);
  t.after(() => Promise.all([server.close(), client.close()]));
  return { api: context.api, mcp: client };
}
