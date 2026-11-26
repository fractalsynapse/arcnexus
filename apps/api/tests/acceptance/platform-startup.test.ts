import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { projectFixture } from '../../../cli/tests/fixtures/project.js';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Client } from 'pg';
import { openPlatform } from '../../../../packages/platform/src/index.js';
import { uiPreferencesDataPlugin } from '../../../../packages/ui/src/preferences/server.js';
import { databaseSetupPlugin } from '../../../db/src/index.js';
import { Context } from 'cordis';
import { createProject } from '../fixtures/project.js';
import { apiPlugin, serveApi } from '../../src/index.js';

export const suite = { owner: 'api-app', level: 'acceptance', tags: ['postgresql'] } as const;

const url = process.env.ARC_TEST_DATABASE_URL;

test(
  'API and MCP platform scopes can share the catalog without exposing arbitrary worktrees',
  { skip: !url },
  async (t) => {
    const { token, platform, repository } = await fixture(t);
    const request = new Request('http://arc.test/', {
      headers: { authorization: 'Bearer ' + token },
    });
    const scope = await platform.authenticate(request, 'platform');
    assert.ok(scope);
    const record = await platform.context.catalog.add(scope.principal, { remote: repository });
    const project = await platform.authenticate(request, record.id);
    assert.ok(project);
    assert.equal(await platform.authenticate(request, randomUUID()), undefined);
    assert.equal(
      await platform.authenticate(new Request('http://arc.test/'), record.id),
      undefined,
    );
    assert.equal(
      ((await platform.context.data.invoke(project, 'goals', 'list', {})) as { revision: string })
        .revision,
      record.revision,
    );
    assert.deepEqual(await platform.context.data.invoke(project, 'project-settings', 'read', {}), {
      revision: record.revision,
      directories: [],
    });
  },
);

async function fixture(t: TestContext, withAgent = false, withEvidence = false) {
  const root = mkdtempSync(join(tmpdir(), 'arc-platform-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repository = 'https://github.com/arcnexus-fixtures/' + randomUUID() + '.git';
  const directory = withAgent ? projectFixture(repository) : join(root, 'project');
  if (withAgent) t.after(() => rmSync(directory, { recursive: true, force: true }));
  else {
    mkdirSync(directory);
    createProject(directory, repository);
  }
  const token = randomUUID();
  const file = join(root, 'bindings.json');
  writeFileSync(
    file,
    JSON.stringify({
      operator: randomUUID(),
      projects: [{ directory, remote: repository, ...(withEvidence && { evidence: root }) }],
    }),
  );
  const database = new Client({ connectionString: url });
  await database.connect();
  t.after(() => database.end());
  const setup = new Context();
  await setup.use(databaseSetupPlugin(database));
  await setup.databaseSetup.migrate();
  const platform = await openPlatform({ database, file, token });
  return { token, platform, repository, directory, root, database, file };
}

test(
  'operator preferences persist across gateway connections and keep independent settings',
  { skip: !url },
  async (t) => {
    const first = await fixture(t);
    const left = await preferenceRequests(first);
    const right = await preferenceRequests({ ...first, database: await separateConnection(t) });
    const site = { kind: 'site', selected: 'midnight' };
    const display = {
      kind: 'display',
      workspace: '/plan/',
      panel: 'metrics',
      selected: 'midnight',
    };
    assert.equal((await left({ entries: [site] })).status, 200);
    assert.equal((await right({ entries: [display] })).status, 200);
    await left({ entries: [{ ...site, selected: 'older browser' }], preserveExisting: true });
    const restored = await right();
    assert.equal(restored.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await restored.json()).entries, [display, site]);
    assert.equal((await right({ entries: [{ ...site, selected: false }] })).status, 400);
    const other = await preferenceRequests(await fixture(t));
    assert.deepEqual(await (await other()).json(), { entries: [] });
    assert.equal((await right(undefined, '')).status, 401);
    const description = await right(undefined, undefined, '/projects/platform/openapi.json');
    assert.ok((await description.json()).paths['/ui-preferences'].patch.requestBody.required);
  },
);

async function separateConnection(t: TestContext) {
  const database = new Client({ connectionString: url });
  await database.connect();
  t.after(() => database.end());
  return database;
}

async function preferenceRequests({ database, token, file }: Awaited<ReturnType<typeof fixture>>) {
  const platform = await openPlatform({ database, token, file });
  await platform.context.use(uiPreferencesDataPlugin(database));
  await platform.context.use(apiPlugin(platform.authenticate));
  return (body?: unknown, credential: string = token, path = '/ui-preferences') =>
    platform.context.api(
      new Request('http://arc.test' + path, {
        method: body ? 'PATCH' : 'GET',
        headers: { authorization: 'Bearer ' + credential },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
}

test(
  'PostgreSQL follow resumes at a scoped cursor after a gateway disconnect',
  { skip: !url },
  async (t) => {
    const { token, platform, repository } = await fixture(t);
    const headers = { authorization: 'Bearer ' + token, accept: 'text/event-stream' };
    const authentication = new Request('http://arc.test/', { headers });
    const scope = await platform.authenticate(authentication, 'platform');
    assert.ok(scope);
    const record = await platform.context.catalog.add(scope.principal, { remote: repository });
    const execution = randomUUID();
    const address =
      'http://arc.test/projects/' + record.id + '/executions/' + execution + '/events';
    await platform.context.use(apiPlugin(platform.authenticate, platform.followTimeline));
    const first = await platform.context.api(new Request(address, { headers }));
    assert.equal(first.headers.get('content-type'), 'text/event-stream');
    const reader = first.body!.getReader();
    await reader.read();
    await append(repository, execution, 1, 'opening');
    const opening = await frame(reader);
    await reader.cancel();
    await append(repository, execution, 2, 'closing');
    const resumed = await platform.context.api(
      new Request(address, {
        headers: { ...headers, 'last-event-id': opening.id },
      }),
    );
    const result = resumed.body!.getReader();
    const closing = await frame(result);
    await result.cancel();
    assert.equal(closing.message, 'closing');
  },
);

async function append(
  repository: string,
  execution: string,
  sequence: number,
  message: string,
  detail?: object,
  run = 1,
  active = 1,
) {
  const writer = new Client({ connectionString: url });
  await writer.connect();
  try {
    await writer.query('BEGIN');
    await writer.query(
      'INSERT INTO arcnexus_coordination.runs (project,id,goal_id,task_id,goal,active) VALUES ($1,$2,$3,$3,$3,$4) ON CONFLICT DO NOTHING',
      [repository, run, execution, active],
    );
    await writer.query(
      'INSERT INTO arcnexus_coordination.events (project,id,run,content) VALUES ($1,$2,$3,$4)',
      [repository, sequence, run, JSON.stringify({ message, ...detail })],
    );
    await writer.query('COMMIT');
  } finally {
    await writer.end();
  }
}

test(
  'Plan change notices follow committed journal writes without sending the journal',
  { skip: !url },
  async (t) => {
    const { token, platform, repository } = await fixture(t);
    const headers = { authorization: 'Bearer ' + token, accept: 'text/event-stream' };
    const scope = await platform.authenticate(
      new Request('http://arc.test/', { headers }),
      'platform',
    );
    assert.ok(scope);
    const record = await platform.context.catalog.add(scope.principal, { remote: repository });
    const url = 'http://arc.test/projects/' + record.id + '/plan-executions';
    await platform.context.use(apiPlugin(platform.authenticate, platform.followTimeline));
    const response = await platform.context.api(new Request(url, { headers }));
    assert.equal(response.headers.get('content-type'), 'text/event-stream');
    const reader = response.body!.getReader();
    const notice = 'event: plan-change\ndata: null\n\n';
    const decode = () => reader.read().then(({ value }) => new TextDecoder().decode(value));
    assert.equal(await decode(), notice);
    await append(repository, randomUUID(), 1, 'A private journal message');
    assert.equal(await decode(), notice);
    await reader.cancel();
  },
);

async function frame(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const result = await reader.read();
  assert.equal(result.done, false);
  const decoded = new TextDecoder().decode(result.value);
  const id = /^id: (.+)$/m.exec(decoded)?.[1];
  const data = /^data: (.+)$/m.exec(decoded)?.[1];
  assert.ok(id);
  assert.ok(data);
  const event = JSON.parse(data) as { observation: { message: string } };
  return { id, message: event.observation.message };
}

test(
  'REST inspection returns the same scoped Commands result as the built CLI',
  { skip: !url },
  async (t) => {
    const { token, platform, repository, directory, root } = await fixture(t, true);
    const headers = { authorization: 'Bearer ' + token };
    const operator = await platform.authenticate(
      new Request('http://arc.test/', { headers }),
      'platform',
    );
    assert.ok(operator);
    const project = await platform.context.catalog.add(operator.principal, { remote: repository });
    await platform.context.use(apiPlugin(platform.authenticate));
    const path =
      'http://arc.test/projects/' + project.id + '/inspection?component=work&activity=testing';
    const cli = fileURLToPath(new URL('../../../cli/src/index.js', import.meta.url));
    const expected = execFileSync(process.execPath, [cli, 'inspect', 'work', 'testing', '--json'], {
      cwd: directory,
      encoding: 'utf8',
    });
    const response = await platform.context.api(new Request(path, { headers }));
    assert.equal(response.status, 200);
    const result: unknown = await response.json();
    assert.deepEqual(result, JSON.parse(expected));
    assert.deepEqual(await platformCli(t, platform.context, project.id, root, token), result);
  },
);

async function platformCli(
  t: TestContext,
  context: Context,
  project: string,
  root: string,
  token: string,
) {
  const { url, server } = await serveApi(context.api);
  t.after(() => server.close());
  const file = join(root, 'operator-token');
  writeFileSync(file, token, { mode: 0o600 });
  const cli = fileURLToPath(new URL('../../../cli/src/index.js', import.meta.url));
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [cli, '--json', 'platform', 'inspect', 'work', 'testing'],
    {
      env: {
        ...process.env,
        ARC_API_URL: url,
        ARC_PROJECT_ID: project,
        ARC_OPERATOR_TOKEN_FILE: file,
      },
    },
  );
  return JSON.parse(stdout) as unknown;
}

test(
  'Plan panels resolve a recorded planning execution and read its projections separately',
  { skip: !url },
  async (t) => {
    const { token, platform, repository } = await fixture(t);
    const headers = { authorization: 'Bearer ' + token };
    const operator = await platform.authenticate(
      new Request('http://arc.test/', { headers }),
      'platform',
    );
    assert.ok(operator);
    const project = await platform.context.catalog.add(operator.principal, { remote: repository });
    const execution = randomUUID();
    await seedPlanAttempts(repository, execution, project.revision);
    await platform.context.use(apiPlugin(platform.authenticate));
    const address = 'http://arc.test/projects/' + project.id + '/plan-executions/';
    await verifyFreshPlan(platform.context, address + execution, headers);
    await append(
      repository,
      execution,
      4,
      'finished',
      {
        outcome: { kind: 'planned', summary: 'Targets mapped' },
        plannerProposal: { proposal: { summary: 'Compared the accepted goals.' } },
        ...planUsage('current', 2000),
      },
      3,
    );
    await verifyPlanPanelResponses(platform.context, address, headers, execution);
  },
);

async function seedPlanAttempts(repository: string, execution: string, revision: string) {
  await append(
    repository,
    execution,
    1,
    'failed',
    {
      planningExecution: { revision },
      outcome: { kind: 'failed', reason: 'First attempt failed' },
    },
    1,
    0,
  );
  await append(
    repository,
    execution,
    2,
    'previous plan completed',
    {
      outcome: { kind: 'planned', summary: 'Previous plan' },
      plannerProposal: { proposal: { summary: 'Previous proposal' } },
      editReceipt: { path: '.arc/goals/previous.md' },
      ...planUsage('previous', 4000),
    },
    2,
    0,
  );
  await append(repository, execution, 3, 'new plan started', {}, 3);
}

function planUsage(activation: string, input_tokens: number) {
  return {
    nativeStarted: { activation },
    nativeEvent: { activation, event: { type: 'turn.completed', usage: { input_tokens } } },
    nativeFinished: { activation, durationMs: 100 },
  };
}

async function verifyFreshPlan(context: Context, address: string, headers: Record<string, string>) {
  const outcome = await context.api(new Request(address + '/outcome', { headers }));
  assert.equal(outcome.status, 200);
  const plan = await outcome.json();
  assert.equal(plan.outcome, null);
  assert.equal(plan.report, undefined);
  assert.deepEqual(plan.changedPaths, []);
  assert.equal(plan.attempt, '3');
  const measurements = await context.api(new Request(address + '/metrics', { headers }));
  assert.equal((await measurements.json()).usage.input_tokens.reported, null);
  const timeline = await context.api(new Request(address + '/events', { headers }));
  const { events } = await timeline.json();
  assert.deepEqual(
    events.map((event: { run: number }) => event.run),
    [1, 2, 3],
  );
}

test(
  'Plan history lists distinct project executions and recognizes older proposal markers',
  { skip: !url },
  async (t) => {
    const { token, platform, repository } = await fixture(t);
    const headers = { authorization: 'Bearer ' + token };
    const operator = await platform.authenticate(
      new Request('http://arc.test/', { headers }),
      'platform',
    );
    assert.ok(operator);
    const project = await platform.context.catalog.add(operator.principal, { remote: repository });
    const executions = await seedPlanHistory(repository, project.revision);
    await platform.context.use(apiPlugin(platform.authenticate));
    const address = 'http://arc.test/projects/' + project.id + '/plan-executions';
    const response = await platform.context.api(new Request(address, { headers }));
    assert.equal(response.status, 200);
    const { entries } = await response.json();
    assert.deepEqual(
      entries.map((entry: { execution: string; active: boolean }) => [
        entry.execution,
        entry.active,
      ]),
      executions,
    );
  },
);

async function seedPlanHistory(repository: string, revision: string) {
  const earlier = randomUUID();
  const latest = randomUUID();
  const marked = { planningExecution: { revision } };
  await append(repository, earlier, 1, 'older proposal', { plannerProposal: {}, revision }, 1, 0);
  await append(repository, latest, 2, 'started', marked, 2, 0);
  await append(repository, latest, 3, 'resumed', {}, 3);
  await append(repository, randomUUID(), 4, 'non-Plan journal entry', {}, 4, 0);
  await append(
    'https://github.com/arcnexus-fixtures/' + randomUUID() + '.git',
    randomUUID(),
    1,
    'different project',
    marked,
  );
  return [
    [latest, true],
    [earlier, false],
  ];
}

async function verifyPlanPanelResponses(
  context: Context,
  address: string,
  headers: Record<string, string>,
  execution: string,
) {
  const current = await context.api(new Request(address + 'current', { headers }));
  assert.equal(current.status, 200);
  assert.equal((await current.json()).execution, execution);
  const outcome = await context.api(new Request(address + execution + '/outcome', { headers }));
  const plan = await outcome.json();
  assert.equal(plan.outcome.summary, 'Targets mapped');
  assert.equal(plan.report.summary, 'Compared the accepted goals.');
  const metrics = await context.api(new Request(address + execution + '/metrics', { headers }));
  assert.equal(metrics.status, 200);
  assert.equal((await metrics.json()).usage.input_tokens.reported, 2000);
  const tokens = await context.api(
    new Request(address + execution + '/token-history', { headers }),
  );
  assert.equal(tokens.status, 200);
  assert.deepEqual((await tokens.json()).samples, [
    { sequence: '4', timestamp: null, input: 2000, output: null },
  ]);
}

test(
  'Plan context reads the exact request from its own retained artifact',
  { skip: !url },
  async (t) => {
    const { token, platform, repository, root } = await fixture(t, false, true);
    const headers = { authorization: 'Bearer ' + token };
    const operator = await platform.authenticate(
      new Request('http://arc.test/', { headers }),
      'platform',
    );
    assert.ok(operator);
    const project = await platform.context.catalog.add(operator.principal, { remote: repository });
    const { execution, request } = await seedPlanContext(repository, project.revision, root);
    await platform.context.use(apiPlugin(platform.authenticate));
    const address = 'http://arc.test/projects/' + project.id + '/plan-executions/';
    const captured = await platform.context.api(
      new Request(address + execution + '/context', { headers }),
    );
    assert.equal(captured.status, 200);
    assert.deepEqual(await captured.json(), { timestamp: null, component: 'planner', request });
    const outside = await platform.context.api(
      new Request(address + randomUUID() + '/context', { headers }),
    );
    assert.notEqual(outside.status, 200);
  },
);

async function seedPlanContext(repository: string, revision: string, root: string) {
  const execution = randomUUID();
  const path = join(root, 'native-request.json');
  const request = {
    input: '## Task\nSource: captured assignment\n\nRecorded objective',
    options: { model: 'live-model' },
  };
  writeFileSync(path, JSON.stringify(request));
  await append(repository, execution, 1, 'started', { planningExecution: { revision } });
  await append(repository, execution, 2, 'stored', { artifact: path });
  await append(repository, execution, 3, 'activated', {
    nativeStarted: { request: path, component: 'planner' },
  });
  return { execution, request };
}
