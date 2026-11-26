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
  workflowReceipt,
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

test(
  'project documentation settings use the normal exact architecture review gate',
  { skip: !connectionString },
  async (t) => {
    const { database, project, remote, revision } = await fixture(t);
    const requests = new WorkflowRequests(database);
    const { api } = await gateway(t, requests, remote, revision);
    const call = commandClient(api);
    const worker = await commands(project, remote);
    const signal = new AbortController().signal;
    const owner = { remote, revision, directory: project.root, worker: 'isolated-host' };
    const id = randomUUID();
    const request = {
      command: 'architecture_update',
      documentation: { revision, directories: ['.arc/goals'] },
    };
    assert.equal((await call('', 'POST', { id, request })).status, 202);
    assert.ok(await runHostedRequest(requests, worker, owner, signal));
    const held = workflowReceipt.parse(await (await call('/' + id)).json());
    assert.equal(held.state, 'waiting', JSON.stringify(held.outcome));
    assert.match(held.gate!.question, /documentationDirectories:\n\+ {2}- \.arc\/goals/);
    const read = () => project.architecture.capture(project.root).project.documentationDirectories;
    assert.equal(read(), undefined);
    await declineSettings(call, held.id, held.gate!.id);
    assert.ok(await runHostedRequest(requests, worker, owner, signal));
    const finished = workflowReceipt.parse(await (await call('/' + id)).json());
    assert.equal(finished.state, 'finished');
    assert.equal(finished.execution, held.execution);
    assert.equal(read(), undefined);
  },
);

async function declineSettings(call: ReturnType<typeof commandClient>, id: string, gate: string) {
  assert.equal((await call('/' + id + '/answer', 'POST', { gate, answer: 'skip' })).status, 202);
}

test(
  'a queued Plan retains its folder selection across retries',
  { skip: !connectionString },
  async (t) => {
    const { database, remote, revision } = await fixture(t);
    const requests = new WorkflowRequests(database);
    const operator = { remote, principal: 'isolated-operator' };
    const owner = { remote, revision, worker: 'isolated-host' };
    const id = randomUUID();
    const plan = { command: 'task_plan', mode: 'recommend-objectives' };
    await requests.submit(operator, id, plan, revision, []);
    await requests.submit(operator, id, plan, revision, ['.arc/goals']);
    const claimed = await requests.claim(owner);
    assert.deepEqual(claimed?.documentationDirectories, []);
  },
);

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
    apiPlugin(
      (_request, project) => ({ project, principal: 'isolated-operator' }),
      undefined,
      (_scope, signal) => requests.watchReceipts(remote, signal),
    ),
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

test(
  'a stopped bare Run finishes the original round from its durable aggregate',
  { skip: !connectionString },
  async (t) => {
    const { database, remote, revision } = await fixture(t);
    const requests = new WorkflowRequests(database);
    const owner = { remote, revision, worker: 'departed-round' };
    const operator = { remote, principal: 'isolated-operator' };
    const id = randomUUID();
    await requests.submit(operator, id, { command: 'task_run' }, revision);
    assert.equal((await requests.claim(owner))?.id, id);
    const store = hostedProjectCoordination({
      project: remote,
      worker: owner.worker,
      connectionString: connectionString!,
    });
    const round = store.round(remote, () => '[]');
    const completed = { kind: 'round', round: round.id, completed: true, goals: [] } as const;
    await requests.completeRound(owner, id, completed);
    assert.equal(await requests.recover(owner, () => true), true);
    const result = await requests.read(operator, id);
    assert.equal(result.state, 'finished');
    assert.deepEqual(result.outcome, completed);
    const next = store.round(remote, () => '[]');
    assert.notEqual(next.id, completed.round);
  },
);

test(
  'the project command stream follows committed gates and replays the retained receipt',
  { skip: !connectionString },
  async (t) => {
    const { database, remote, revision } = await fixture(t);
    const receipts = new WorkflowRequests(database);
    const { api } = await gateway(t, receipts, remote, revision);
    const operator = { remote, principal: 'isolated-operator' };
    const owner = { remote, revision, worker: 'stream-worker' };
    const id = randomUUID();
    const address = new Request('http://arc.local/projects/fixture/commands/current', {
      headers: { accept: 'text/event-stream' },
    });
    const response = await api(address);
    assert.equal(response.status, 200);
    const stream = response.body!.getReader();
    try {
      assert.equal((await nextReceipt(stream)).receipt, null);
      await receipts.submit(operator, id, { command: 'task_plan' }, revision);
      assert.equal((await nextReceipt(stream)).receipt.state, 'queued');
      await receipts.claim(owner);
      assert.equal((await nextReceipt(stream)).receipt.state, 'running');
      await receipts.settle(owner, id, { kind: 'blocked' }, { id: 'exact', question: 'Approve?' });
      assert.equal((await nextReceipt(stream)).receipt.gate.id, 'exact');
    } finally {
      await stream.cancel();
    }
    const current = await api(new Request(address.url));
    assert.equal((await current.json()).receipt.id, id);
  },
);

async function nextReceipt(stream: ReadableStreamDefaultReader<Uint8Array>) {
  const frame = await stream.read();
  assert.ok(frame.value);
  const data = /^data: (.+)$/m.exec(new TextDecoder().decode(frame.value))?.[1];
  assert.ok(data);
  return JSON.parse(data);
}

test(
  'a retained approval can only be resumed by its pinned Host image',
  { skip: !connectionString },
  async (t) => {
    const { database, remote, revision } = await fixture(t);
    const requests = new WorkflowRequests(database);
    const operator = { remote, principal: 'isolated-operator' };
    const runtime = { image: 'sha256:' + 'a'.repeat(64), base: 'sha256:' + 'b'.repeat(64) };
    const owner = { remote, worker: 'pinned-host', revision, runtime };
    const id = randomUUID();
    await requests.submit(operator, id, { command: 'task_plan' }, revision);
    assert.equal((await requests.claim(owner))?.id, id);
    await requests.settle(owner, id, { kind: 'blocked' }, { id: 'gate', question: 'Approve?' });
    await requests.answer(operator, id, 'gate', 'approve');
    const changed = { ...owner, runtime: { ...runtime, image: 'sha256:' + 'c'.repeat(64) } };
    await assert.rejects(requests.claim(changed), /pinned Host image/);
    assert.equal((await requests.claim(owner))?.id, id);
  },
);
