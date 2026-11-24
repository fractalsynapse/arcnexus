import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Context } from 'cordis';
import { Client } from 'pg';
import {
  Coordination,
  reconcileHosted,
  hostedProjectCoordination,
  readImportedTimeline,
  readOperationEvidence,
} from '../../../../packages/coordination/src/index.js';
import { databaseSetupPlugin } from '../../src/index.js';

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
