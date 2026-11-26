import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Context } from 'cordis';
import { Architecture } from '../../../../packages/architecture/src/index.js';
import {
  coordinationDataPlugin,
  coordinationPlugin,
  timelineChanges,
} from '../../../../packages/coordination/src/index.js';
import { dataPlugin } from '../../../../packages/data/src/index.js';
import { plannerDataPlugin } from '../../../../packages/planner/src/index.js';
import { operatorMcpHttp, operatorMcpPlugin } from '../../../mcp/src/index.js';
import { apiPlugin, serveApi } from '../../src/index.js';
import { createProject, firstGoal, moveFirstGoal, remote } from '../fixtures/project.js';

export const suite = { owner: 'api-app', level: 'acceptance', tags: ['gateway'] } as const;

const scope = { project: 'fixture', principal: 'operator' };
const headers = { authorization: 'Bearer isolated-fixture' };

function authenticate(request: Request, project: string) {
  return request.headers.get('authorization') === headers.authorization && project === scope.project
    ? scope
    : undefined;
}

async function gateway(t: TestContext, moved?: string) {
  const { root, original, capture } = captureFixture(t, moved);
  const context = new Context();
  await context.use(
    dataPlugin(
      ({ scope: caller }) =>
        caller.project === scope.project && caller.principal === scope.principal,
    ),
  );
  const storage = join(root, 'state');
  await context.use(coordinationPlugin(storage));
  await context.use(coordinationDataPlugin(() => remote));
  await context.use(
    plannerDataPlugin((_scope, expected) =>
      expected === original.source.revision ? original : capture,
    ),
  );
  await context.use(
    apiPlugin(
      authenticate,
      timelineChanges(storage, () => remote),
    ),
  );
  await context.use(operatorMcpPlugin);
  return { context, revision: capture.source.revision, original: original.source.revision };
}

function captureFixture(t: TestContext, moved?: string) {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-gateways-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repository = join(root, 'repo');
  mkdirSync(repository);
  createProject(repository);
  const architecture = new Architecture();
  const original = architecture.capture(repository);
  if (moved) moveFirstGoal(repository, moved);
  const capture = moved ? architecture.capture(repository) : original;
  return { root, original, capture };
}

async function mcp(context: Context, t: TestContext) {
  const client = new Client({ name: 'isolated-test', version: '1' });
  const { server, url } = await serveApi(operatorMcpHttp(context.operatorMcp, authenticate));
  t.after(async () => {
    await client.close();
    server.close();
  });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(url + '/projects/fixture/mcp'), {
      requestInit: { headers },
    }),
  );
  return client;
}

test('the REST and MCP adapters expose the same captured goals', async (t) => {
  const { context, revision } = await gateway(t);
  const { server, url } = await serveApi(context.api);
  t.after(() => server.close());
  const address = url + '/projects/fixture';
  const denied = await fetch(address + '/goals');
  assert.equal(denied.status, 401);
  const goals = await fetch(address + '/goals', { headers });
  assert.equal(goals.status, 200);
  const read = await goals.json();
  assert.equal(read.revision, revision);
  assert.equal(read.entries.length, 1);
  assert.equal(read.entries[0].id, 'first');
  assert.equal(read.entries[0].priority, 1);
  assert.equal(read.entries[0].path, '.arc/goals/first.md');
  assert.ok(read.entries[0].updated);
  const spec = await (await fetch(address + '/openapi.json', { headers })).json();
  assert.ok(spec.paths['/projects/{project}/goals']);
  const client = await mcp(context, t);
  const listed = await client.listTools();
  assert.ok(listed.tools.some((tool) => tool.name === 'list_goals'));
  assert.deepEqual(
    (await client.callTool({ name: 'list_goals', arguments: {} })).structuredContent,
    read,
  );
});

test('a Plan file exposes only revisions from the captured guide history', async (t) => {
  const { context, revision } = await gateway(t);
  const base = 'http://arc.test/projects/fixture/goals/first';
  const history = await context.api(
    new Request(base + '/revisions?revision=' + revision, { headers }),
  );
  assert.equal(history.status, 200);
  const { revisions } = await history.json();
  assert.equal(revisions[0].revision, revision);
  const changes = await context.api(
    new Request(base + '/changes?revision=' + revision, { headers }),
  );
  assert.deepEqual(await changes.json(), {
    path: '.arc/goals/first.md',
    before: '',
    after: firstGoal,
  });
  const refused = await context.api(new Request(base + '?fileRevision=HEAD', { headers }));
  assert.equal(refused.status, 409);
});

test('a moved categorized guide keeps its stable endpoint and its original pinned path', async (t) => {
  const path = '.arc/goals/quality/reliable-reviews.md';
  const { context, revision, original } = await gateway(t, path);
  const address = 'http://arc.test/projects/fixture/goals/first?revision=';
  const current = await context.api(new Request(address + revision, { headers }));
  assert.equal(current.status, 200);
  const { entry } = await current.json();
  assert.deepEqual(entry, {
    id: 'first',
    path,
    category: 'quality',
    name: 'First goal',
    priority: 1,
  });
  const pinned = await context.api(new Request(address + original, { headers }));
  assert.equal(pinned.status, 200);
  const result = await pinned.json();
  assert.equal(result.entry.path, '.arc/goals/first.md');
  assert.equal(result.content, firstGoal);
  await verifyMovedGuideHistory(context.api, revision, original);
});

async function verifyMovedGuideHistory(
  api: (request: Request) => Promise<Response>,
  revision: string,
  previous: string,
) {
  const base = 'http://arc.test/projects/fixture/goals/first';
  const list = await api(new Request(base + '/revisions?revision=' + revision, { headers }));
  assert.equal(list.status, 200);
  const { revisions } = await list.json();
  assert.deepEqual(
    revisions.map((entry: { revision: string }) => entry.revision),
    [revision, previous],
  );
  const historical = await api(
    new Request(base + '?revision=' + revision + '&fileRevision=' + previous, { headers }),
  );
  assert.equal(historical.status, 200);
  assert.equal((await historical.json()).content, firstGoal);
}

test('a REST cursor replays the same committed timeline through MCP', async (t) => {
  const { context } = await gateway(t);
  const journal = context.coordination.admit(remote, 'Plan');
  assert.ok('record' in journal);
  const first = journal.record({ message: 'Opening' });
  const address = 'http://arc.test/projects/fixture/executions/' + first.taskID + '/events';
  const response = await context.api(new Request(address, { headers }));
  assert.equal(response.status, 200);
  const replay = await response.json();
  assert.deepEqual(replay.events, JSON.parse(JSON.stringify([first])));
  const completion = journal.record({ message: 'Finished' });
  journal.close();
  const client = await mcp(context, t);
  const later = await client.callTool({
    name: 'read_execution_timeline',
    arguments: { execution: first.taskID, after: replay.through },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(later.structuredContent)), {
    through: { ...replay.through, sequence: completion.sequence },
    events: JSON.parse(JSON.stringify([completion])),
  });
});

test('the event stream carries committed messages and resumes after the last event ID', async (t) => {
  const { context } = await gateway(t);
  const journal = context.coordination.admit(remote, 'Streaming Plan');
  assert.ok('record' in journal);
  t.after(() => journal.close());
  const first = journal.record({ message: 'Opening' });
  const { server, url: origin } = await serveApi(context.api);
  t.after(() => server.close());
  const url = origin + '/projects/fixture/executions/' + first.taskID + '/events';
  const resume = Buffer.from(
    JSON.stringify({ project: 'fixture', execution: first.taskID, sequence: first.sequence }),
  ).toString('base64url');
  const response = await fetch(url, {
    headers: { ...headers, accept: 'text/event-stream', 'last-event-id': resume },
  });
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  const reader = response.body!.getReader();
  t.after(() => reader.cancel());
  await reader.read();
  const last = journal.record({ message: 'Closing' });
  const chunk = await nextObservation(reader);
  assert.ok(chunk.includes('id: '));
  assert.ok(chunk.includes('"sequence":"' + last.sequence + '"'));
  assert.ok(chunk.includes('"message":"Closing"'));
  assert.ok(!chunk.includes('Opening'));
});

async function nextObservation(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let chunk = '';
  while (!chunk.includes('event: observation')) {
    const reading = await reader.read();
    assert.equal(reading.done, false);
    chunk += decoder.decode(reading.value, { stream: true });
  }
  return chunk;
}
