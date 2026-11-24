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
  HostedCoordination,
  readImportedTimeline,
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
    const hosted = new HostedCoordination(connect);
    await assert.rejects(hosted.admit(project, 'Hosted', 'worker-a'), /cutover/);
    await cutoverWithArtifact(setup, directory, project);
    assert.throws(() => sqlite.admit(project, 'Late native'), /PostgreSQL/);
    assert.throws(() => native.record({ message: 'stale handle' }), /PostgreSQL/);
    assert.deepEqual(
      await readImportedTimeline(database, project, native.taskID),
      sqlite.readTaskTimeline(project, native.taskID),
    );
    const writer = await hosted.admit(project, 'Hosted', 'worker-a');
    assert.ok('record' in writer);
    t.after(() => writer.close());
    const competing = await hosted.admit(project, 'Competing', 'worker-b');
    assert.ok('activeGoal' in competing);
    assert.equal(competing.activeGoal, 'Hosted');
    const message = await writer.record({ message: 'committed' });
    await writer.finish({ kind: 'satisfied' });
    const loaded = await readImportedTimeline(database, project, writer.taskID);
    assert.equal(loaded.events[0]?.sequence, message.sequence);
  },
);

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
    const coordination = new HostedCoordination(connect);
    const first = await coordination.admit(project, 'Paused', 'old-container');
    assert.ok('record' in first);
    await first.record({ clarification: { question: 'Approve exact change?', proposal: 'sha' } });
    await first.close();
    await assert.rejects(first.record({ reply: 'Late' }), /closed/);
    assert.ok('activeGoal' in (await coordination.admit(project, 'Paused', 'replacement')));
    assert.equal(await coordination.reconcile(project, () => false), false);
    assert.equal(await coordination.reconcile(project, (owner) => owner === 'old-container'), true);
    const replacement = await coordination.admit(project, 'Paused', 'replacement');
    assert.ok('record' in replacement);
    t.after(() => replacement.close());
    assert.equal(replacement.taskID, first.taskID);
    const recovered = await readImportedTimeline(database, project, replacement.taskID);
    assert.deepEqual(
      recovered.events.map((entry) => entry.observation),
      [
        { clarification: { question: 'Approve exact change?', proposal: 'sha' } },
        { outcome: { kind: 'cancelled', reason: 'Hosted writer exited', evidence: [] } },
      ],
    );
  },
);
