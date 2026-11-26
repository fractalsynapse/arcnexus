import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Context } from 'cordis';
import { Client } from 'pg';
import {
  Coordination,
  Journal,
  WorkflowRequests,
  reconcileHosted,
  hostedProjectCoordination,
  readImportedTimeline,
  readOperationEvidence,
} from '../../../../packages/coordination/src/index.js';
import { databaseSetupPlugin } from '../../src/index.js';
import {
  listPlanReferences,
  readPlanReference,
} from '../../../../packages/coordination/src/postgres/plan-records.js';

export const suite = { owner: 'db-app', level: 'integration', tags: ['postgresql'] } as const;
const url = process.env.ARC_TEST_DATABASE_URL;

async function connect() {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

async function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'arc-cutover-'));
  const database = await connect();
  t.after(async () => {
    await database.end();
    rmSync(directory, { recursive: true, force: true });
  });
  const context = new Context();
  await context.use(databaseSetupPlugin(database));
  await context.databaseSetup.migrate();
  const project = 'https://github.com/example/' + randomUUID() + '.git';
  const sqlite = new Coordination(directory);
  return { directory, database, project, sqlite, setup: context.databaseSetup };
}

test(
  'cutover fences native admission and grants one durable hosted writer',
  { skip: !url },
  async (t) => {
    const { directory, database, project, sqlite, setup } = await fixture(t);
    const native = sqlite.admit(project, 'Native');
    assert.ok('record' in native);
    await assert.rejects(setup.cutover(directory, project), /active SQLite writer/);
    native.record({ artifact: join(directory, 'proof') });
    native.finish({ kind: 'satisfied' });
    t.after(() => native.close());
    const hosted = coordinated(project, 'worker-a');
    assert.throws(() => hosted.admit(project, 'Hosted'), /cutover/);
    await cutoverWithArtifact(setup, directory, project);
    assert.throws(() => sqlite.admit(project, 'Late native'), /PostgreSQL/);
    assert.throws(() => native.record({ message: 'stale handle' }), /PostgreSQL/);
    assert.deepEqual(
      await readImportedTimeline(database, project, native.taskID),
      sqlite.readTaskTimeline(project, native.taskID),
    );
    const writer = hosted.admit(project, 'Hosted');
    assert.ok('record' in writer);
    t.after(() => writer.close());
    const competing = coordinated(project, 'worker-b').admit(project, 'Competing');
    assert.ok('activeGoal' in competing);
    assert.equal(competing.activeGoal, 'Hosted');
    const message = writer.record({ message: 'committed' });
    writer.finish({ kind: 'satisfied' });
    const loaded = await readImportedTimeline(database, project, writer.taskID);
    assert.equal(loaded.events[0]?.sequence, message.sequence);
  },
);

function coordinated(project: string, worker: string) {
  return hostedProjectCoordination({ project, worker, connectionString: url! });
}

test(
  'cutover preserves both histories when retired discovery and SQLite IDs overlap',
  { skip: !url },
  async (t) => {
    const { directory, database, project, sqlite, setup } = await fixture(t);
    const native = sqlite.admit(project, 'Native history');
    assert(native instanceof Journal);
    native.record({ planningExecution: { revision: 'native-revision' } });
    native.finish({ kind: 'planned' });
    native.close();
    const before = sqlite.readTaskTimeline(project, native.taskID);
    const lastNative = Date.parse(before.events.at(-1)!.timestamp!);
    await retiredDiscovery(database, project, new Date(lastNative + 1).toISOString());
    const legacy = await readImportedTimeline(database, project, 'retired-plan');
    assert.equal(legacy.events[0]?.sequence, before.events[0]?.sequence);
    const receipt = await setup.cutover(directory, project);
    assert.deepEqual(await setup.cutover(directory, project), receipt);
    assert.deepEqual(await readImportedTimeline(database, project, native.taskID), before);
    assert.deepEqual(await readImportedTimeline(database, project, 'retired-plan'), legacy);
    assert.deepEqual(
      (await listPlanReferences(database, project)).map(({ execution }) => execution),
      ['retired-plan', native.taskID],
    );
    assert.equal((await readPlanReference(database, project))?.execution, 'retired-plan');
  },
);

async function retiredDiscovery(database: Client, project: string, recordedAt: string) {
  await database.query(
    `INSERT INTO arcnexus_coordination.runs
    (project,id,goal_id,task_id,goal,active,documentation_only)
    VALUES ($1,1,'retired-goal','retired-plan','Retired Plan',0,true)`,
    [project],
  );
  await database.query(
    `INSERT INTO arcnexus_coordination.events
    (project,id,run,content,recorded_at) VALUES ($1,1,1,$2,$3)`,
    [
      project,
      JSON.stringify({
        planningExecution: { revision: 'retired-revision' },
        answer: 'Retained answer',
      }),
      recordedAt,
    ],
  );
}

async function cutoverWithArtifact(
  setup: Context['databaseSetup'],
  directory: string,
  project: string,
) {
  const receipt = await setup.rehearseImport(directory, project);
  await assert.rejects(setup.cutover(directory, project), /ENOENT/);
  writeFileSync(join(directory, 'proof'), 'fixture check output');
  const saved = await setup.cutover(directory, project);
  assert.equal(saved.digest, receipt.digest);
  assert.match(saved.artifacts[join(directory, 'proof')]!, /^[0-9a-f]{64}$/);
}

test(
  'disconnect preserves the active position until the exact owner is reconciled',
  { skip: !url },
  async (t) => {
    const { directory, project, sqlite, setup, database } = await fixture(t);
    const native = sqlite.admit(project, 'Preparation');
    assert.ok('record' in native);
    native.finish({ kind: 'satisfied' });
    native.close();
    await setup.cutover(directory, project);
    const first = coordinated(project, 'old-container').admit(project, 'Paused');
    assert.ok('record' in first);
    first.record({ clarification: { question: 'Approve exact change?', proposal: 'sha' } });
    first.close();
    assert.throws(() => first.record({ reply: 'Late' }), /closed/);
    const next = coordinated(project, 'replacement');
    assert.ok('activeGoal' in next.admit(project, 'Paused'));
    assert.equal(await reconcileHosted(database, project, () => false), false);
    assert.equal(
      await reconcileHosted(database, project, (owner) => owner === 'old-container'),
      true,
    );
    const replacement = next.admit(project, 'Paused');
    assert.ok('record' in replacement);
    t.after(() => replacement.close());
    assert.equal(replacement.taskID, first.taskID);
    const recovered = await readImportedTimeline(database, project, replacement.taskID);
    assertRecovered(recovered.events, first.run);
  },
);

function assertRecovered(events: readonly { observation: unknown }[], previous: number) {
  assert.deepEqual(
    events.map((entry) => entry.observation),
    [
      { clarification: { question: 'Approve exact change?', proposal: 'sha' } },
      { outcome: { kind: 'cancelled', reason: 'Hosted writer exited', evidence: [] } },
      { recovering: previous },
    ],
  );
}

test(
  'the hosted journal reads owner research with and without a request ID',
  { skip: !url },
  async (t) => {
    const { directory, project, sqlite, setup } = await fixture(t);
    const native = sqlite.admit(project, 'Preparation');
    assert.ok('record' in native);
    native.finish({ kind: 'satisfied' });
    native.close();
    await setup.cutover(directory, project);
    const journal = coordinated(project, 'fixture-host').admit(project, 'Research history');
    assert.ok('record' in journal);
    t.after(() => journal.close());
    const first = { component: 'work', request: { id: 'first' }, archive: 'first.md' };
    const second = { component: 'work', request: { id: 'second' }, archive: 'second.md' };
    journal.record({ researchResult: first });
    journal.record({ researchResult: second });
    journal.record({ researchResult: { ...first, component: 'other' } });

    assert.deepEqual(journal.researchReports('work'), [second, first]);
    assert.deepEqual(journal.researchReports('work', 'first'), [first]);
    assert.deepEqual(journal.researchReports('work', 'missing'), []);
  },
);

test(
  'cutover retires a departed native writer and preserves its complete nested position',
  { skip: !url },
  async (t) => {
    const { directory, database, project, setup } = await fixture(t);
    crashNativeWriter(directory, project);
    const imported = await setup.rehearseImport(directory, project);
    const published = await setup.cutover(directory, project);
    assert.equal(published.digest, imported.digest);

    const operator = { remote: project, principal: 'fixture-operator' };
    const receipt = await new WorkflowRequests(database).submit(
      operator,
      randomUUID(),
      { command: 'refine', rounds: '3' },
      'pinned',
    );
    assert.equal(receipt.state, 'queued');
    const resumed = coordinated(project, 'replacement').admit(project, 'Foreground refinement');
    assert(resumed instanceof Journal);
    t.after(() => resumed.close());
    assert.deepEqual(await setup.cutover(directory, project), published);
    assert.equal(
      'activeGoal' in coordinated(project, 'competing').admit(project, 'Competing'),
      true,
    );
    finishImportedPosition(resumed);
  },
);

function crashNativeWriter(directory: string, project: string) {
  const crashed = fileURLToPath(
    new URL('../../../../packages/coordination/tests/fixtures/crashed-writer.js', import.meta.url),
  );
  assert.throws(() => execFileSync(process.execPath, [crashed, directory, project]), {
    signal: 'SIGKILL',
  });
}

function finishImportedPosition(resumed: Journal) {
  const phase = resumed.child('Architect', 'round:1:architect');
  assert(phase instanceof Journal);
  const task = phase.child('Prerequisite', 'implementation');
  assert(task instanceof Journal);
  assert.deepEqual(task.retained?.events, [
    { answer: 'Complete retained answer', checkpoint: 'secured-head', issue: '10' },
    { outcome: { kind: 'cancelled', reason: 'SQLite writer exited before cutover', evidence: [] } },
  ]);
  task.finish({ kind: 'merged' });
  phase.finish({ kind: 'planned' });
  resumed.finish({ kind: 'refined' });
}

test(
  'the native journal interface runs its nested workflow against PostgreSQL',
  { skip: !url },
  async (t) => {
    const { directory, database, project, sqlite, setup } = await fixture(t);
    const native = sqlite.admit(project, 'Preparation');
    assert.ok('record' in native);
    native.finish({ kind: 'satisfied' });
    native.close();
    await setup.cutover(directory, project);
    const store = hostedProjectCoordination({
      project,
      worker: 'fixture-host',
      connectionString: url!,
    });
    const root = store.admit(project, 'Refine', true, 'refine', true);
    assert.ok(root && 'record' in root);
    try {
      const child = finishNestedJournal(root);
      const replay = await readImportedTimeline(database, project, root.taskID);
      assert.deepEqual(
        replay.events.map((event) => event.taskID),
        [root.taskID, child.taskID, child.taskID, root.taskID],
      );
    } finally {
      root.close();
    }
  },
);

function finishNestedJournal(
  root: Extract<ReturnType<Coordination['admit']>, { record: unknown }>,
) {
  const child = root.child('Plan', 'plan');
  assert.ok(child && 'record' in child);
  child.record({ clarification: { question: 'Review the exact proposal', answer: 'approve' } });
  assert.throws(() => root.finish({ kind: 'refined' }), /active child/);
  child.finish({ kind: 'planned' });
  assert.deepEqual(root.childEvents('Plan', 'plan'), [
    { clarification: { question: 'Review the exact proposal', answer: 'approve' } },
    { outcome: { kind: 'planned' } },
  ]);
  root.finish({ kind: 'refined' });
  return child;
}

test(
  'raw tool inputs and outputs require the exact retained event and mounted storage',
  { skip: !url },
  async (t) => {
    const { directory, database, project, sqlite, setup } = await fixture(t);
    const writer = sqlite.admit(project, 'Evidence');
    assert.ok('record' in writer);
    const call = recordOperation(writer, directory, 'call', { input: { path: 'readme.md' } });
    recordOperation(writer, directory, 'result', { output: 'Complete contents' });
    writer.finish({ kind: 'satisfied' });
    writer.close();
    await setup.cutover(directory, project);
    assert.deepEqual(
      await readOperationEvidence(database, project, writer.taskID, call.sequence, directory),
      {
        entries: [{ input: { path: 'readme.md' } }, { output: 'Complete contents' }],
      },
    );
    await verifyEvidenceScope(database, project, writer.taskID, call.sequence, directory);
  },
);

test(
  'the hosted writer and the retained archive share the scoped evidence reader',
  { skip: !url },
  async (t) => {
    const { directory, database, project, sqlite, setup } = await fixture(t);
    const [archive, live] = evidenceDirectories(directory);
    const native = sqlite.admit(project, 'Archived Plan');
    assert.ok('record' in native);
    const saved = recordOperation(native, archive, 'completed', { output: 'Reviewed result' });
    native.finish({ kind: 'planned' });
    native.close();
    await setup.cutover(directory, project);
    const writer = coordinated(project, 'live-evidence-host').admit(project, 'Live Plan');
    assert.ok('record' in writer);
    t.after(() => writer.close());
    const call = recordOperation(writer, live, 'started', { args: { path: 'README.md' } });
    const read = (execution: string, sequence: string) =>
      readOperationEvidence(database, project, execution, sequence, [archive, live]);
    assert.deepEqual((await read(writer.taskID, call.sequence)).entries, [
      { args: { path: 'README.md' } },
    ]);
    recordOperation(writer, live, 'completed', { result: { content: 'Current contents' } });
    assert.deepEqual((await read(writer.taskID, call.sequence)).entries, [
      { args: { path: 'README.md' } },
      { result: { content: 'Current contents' } },
    ]);
    assert.deepEqual((await read(native.taskID, saved.sequence)).entries, [
      { output: 'Reviewed result' },
    ]);
    await assert.rejects(read(writer.taskID, saved.sequence), /not retained/);
  },
);

function evidenceDirectories(directory: string) {
  const paths = [join(directory, 'archive'), join(directory, 'host')] as const;
  for (const path of paths) mkdirSync(path);
  return paths;
}

function recordOperation(
  writer: Extract<ReturnType<Coordination['admit']>, { record: unknown }>,
  directory: string,
  phase: string,
  value: object,
) {
  const source = join(directory, phase + '.json');
  writeFileSync(source, JSON.stringify(value));
  writer.record({ artifact: source });
  return writer.record({ operation: { source, phase, call: 'matching-fixture' } });
}

async function verifyEvidenceScope(
  database: Client,
  project: string,
  task: string,
  sequence: string,
  directory: string,
) {
  await assert.rejects(
    readOperationEvidence(database, project, 'wrong-task', sequence, directory),
    /not retained/,
  );
  await assert.rejects(
    readOperationEvidence(database, 'wrong-project', task, sequence, directory),
    /not retained/,
  );
  await assert.rejects(
    readOperationEvidence(database, project, task, sequence, join(directory, 'missing')),
  );
}
