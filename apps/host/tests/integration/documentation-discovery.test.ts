import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Context } from 'cordis';
import { Client } from 'pg';
import { agentPlugin } from '../../../../packages/agent/src/index.js';
import { architecturePlugin } from '../../../../packages/architecture/src/index.js';
import { Capacity } from '../../../../packages/capacity/src/index.js';
import { commandsPlugin, workflowReceipt } from '../../../../packages/commands/src/index.js';
import {
  readImportedTimeline,
  WorkflowRequests,
} from '../../../../packages/coordination/src/index.js';
import { openPlatform } from '../../../../packages/platform/src/index.js';
import { teamPlugin } from '../../../../packages/team/src/index.js';
import { apiPlugin } from '../../../api/src/index.js';
import { databaseSetupPlugin } from '../../../db/src/index.js';
import { hostedHostPlugin, runHostedRequest } from '../../src/index.js';

export const suite = { owner: 'host-app', level: 'integration', tags: ['postgresql'] } as const;
const connectionString = process.env.ARC_TEST_DATABASE_URL;
const request = {
  command: 'task_plan',
  mode: 'recommend-objectives',
  focus: 'handbook/operations',
};

test(
  'a catalog-free project retains reviewed drafts through hosted admission without granting writes',
  { skip: !connectionString },
  async (t) => {
    const fixture = await discoveryFixture(t);
    const { caller, commands, database, owner, project, provider } = fixture;
    const requests = new WorkflowRequests(database);
    assert.equal(
      (await caller('', 'POST', { id: randomUUID(), request: { command: 'task_run' } })).status,
      409,
    );
    const id = randomUUID();
    const queued = await caller('', 'POST', { id, request });
    assert.equal(queued.status, 202);
    assert.equal(await requests.claim({ ...owner, documentationOnly: false }), undefined);
    const signal = new AbortController().signal;
    const assignments = fixture.platform.hostAssignments(provider, signal);
    assert.deepEqual((await assignments.next()).value, {
      project,
      revision: owner.revision,
      documentationOnly: true,
    });
    await assignments.return(undefined);
    assert.ok(await runHostedRequest(requests, commands, owner, signal));
    const completed = await completeDiscovery(fixture, requests, id, signal);
    await verifyRetainedDiscovery(fixture, completed.execution!);
  },
);

async function verifyRetainedDiscovery(
  fixture: Awaited<ReturnType<typeof discoveryFixture>>,
  execution: string,
) {
  const { database, owner, setup, project } = fixture;
  const journal = await readImportedTimeline(database, owner.remote, execution);
  assert.match(JSON.stringify(journal.events), /onboardingSelection.*measure-recovery/);
  assert.doesNotMatch(JSON.stringify(journal.events), /"plannerEdits"/);
  await setup.databaseSetup.cutover(fixture.storage, owner.remote);
  assert.deepEqual(await readImportedTimeline(database, owner.remote, execution), journal);
  assert.equal((await fixture.platform.context.catalog.list(fixture.operator))[0]?.id, project);
}

async function completeDiscovery(
  { caller, commands, owner }: Awaited<ReturnType<typeof discoveryFixture>>,
  requests: WorkflowRequests,
  id: string,
  signal: AbortSignal,
) {
  const held = workflowReceipt.parse(await (await caller('/' + id)).json());
  assert.equal(held.state, 'waiting', JSON.stringify(held.outcome));
  const gate = held.gate!;
  assert.equal(gate.review?.readOnly, true);
  assert.equal(gate.review?.drafts.length, 2);
  const invalid = JSON.stringify({ action: 'approve', selected: ['not-a-draft'] });
  const answer = (reply: string) =>
    caller('/' + id + '/answer', 'POST', { gate: gate.id, answer: reply });
  assert.equal((await answer(invalid)).status, 409);
  assert.equal(
    (await answer(JSON.stringify({ action: 'approve', selected: ['measure-recovery'] }))).status,
    202,
  );
  assert.ok(await runHostedRequest(requests, commands, owner, signal));
  const result = workflowReceipt.parse(await (await caller('/' + id)).json());
  assert.equal(result.state, 'finished');
  assert.equal(result.execution, held.execution);
  assert.equal((result.outcome as { kind: string }).kind, 'planned');
  return result;
}

async function discoveryFixture(t: TestContext) {
  const workspace = projectFixture(t);
  const { remote, revision, directory, storage, executable } = workspace;
  const { database, setup, operator, provider } = await discoveryDatabase(t);
  const platform = await discoveryPlatform(workspace, database, operator, provider);
  const selected = await platform.context.catalog.add(operator, { remote });
  const owner = { remote, revision, directory, worker: 'document-reader', documentationOnly: true };
  const commands = await discoveryHost(owner, storage, executable);
  const caller = (path: string, method = 'GET', body?: object) =>
    platform.context.api(
      new Request('http://arc.local/projects/' + selected.id + '/commands' + path, {
        method,
        body: body && JSON.stringify(body),
        headers: { authorization: 'Bearer fixture' },
      }),
    );
  return {
    database,
    setup,
    operator,
    commands,
    owner,
    caller,
    platform,
    storage,
    provider,
    project: selected.id,
  };
}

async function discoveryDatabase(t: TestContext) {
  const database = new Client({ connectionString });
  await database.connect();
  t.after(() => database.end());
  const setup = new Context();
  await setup.use(databaseSetupPlugin(database));
  await setup.databaseSetup.migrate();
  const operator = randomUUID();
  const capacity = new Capacity(database);
  const { id: provider } = await capacity.claim(await capacity.issue(operator), {
    name: 'Discovery',
    platform: 'linux-x64',
  });
  await capacity.decide(operator, provider, 'admitted');
  return { database, setup, operator, provider };
}

async function discoveryHost(
  owner: { remote: string; revision: string; worker: string },
  storage: string,
  executable: string,
) {
  const { remote, revision } = owner;
  const host = new Context();
  for (const plugin of [teamPlugin, architecturePlugin, agentPlugin]) await host.use(plugin);
  await host.use(
    hostedHostPlugin(storage, {
      project: remote,
      worker: owner.worker,
      connectionString: connectionString!,
      documentationOnly: true,
      discovery: { remote, revision, executable },
    }),
  );
  await host.use(commandsPlugin);
  return host.commands;
}

async function discoveryPlatform(
  { file, directory, remote }: ReturnType<typeof projectFixture>,
  database: Client,
  operator: string,
  provider: string,
) {
  writeFileSync(
    file,
    JSON.stringify({
      operator,
      projects: [{ remote, directory, provider, documentationOnly: true }],
    }),
  );
  const platform = await openPlatform({ database, file, token: 'fixture' });
  await platform.context.use(apiPlugin(platform.authenticate));
  return platform;
}

function projectFixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'arc-documentation-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const [directory, storage, file, executable] = [
    'source',
    'state',
    'bindings.json',
    'codex.mjs',
  ].map((name) => join(root, name)) as [string, string, string, string];
  const remote = 'https://github.com/fixtures/' + randomUUID() + '.git';
  const revision = createDocumentationRepository(directory, remote);
  const code = readFileSync(
    new URL('../fixtures/documentation-provider.js', import.meta.url),
    'utf8',
  );
  writeFileSync(executable, code.replace(/^#![^\n]*/, '#!' + process.execPath), { mode: 0o700 });
  return { directory, storage, remote, revision, file, executable };
}

function createDocumentationRepository(directory: string, remote: string) {
  mkdirSync(join(directory, 'handbook/operations'), { recursive: true });
  mkdirSync(join(directory, '.codex'));
  writeFileSync(join(directory, 'AGENTS.md'), 'UNTRUSTED_TARGET_CONFIGURATION');
  writeFileSync(join(directory, '.codex/config.toml'), 'UNTRUSTED_TARGET_CONFIGURATION');
  writeFileSync(
    join(directory, 'handbook/operations/recovery.adoc'),
    'Practice recovery and measure downtime.\n',
  );
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();
  git('init', '-b', 'docs');
  git('remote', 'add', 'origin', remote);
  git('add', '.');
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-m',
    'Existing project documentation',
  );
  const revision = git('rev-parse', 'HEAD');
  writeFileSync(join(directory, 'handbook/operations/recovery.adoc'), 'Uncommitted change.');
  return revision;
}
