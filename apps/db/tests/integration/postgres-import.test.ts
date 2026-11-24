import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Context } from 'cordis';
import { Client } from 'pg';
import {
  Coordination,
  importedCoordinationDataPlugin,
  readImportedTimeline,
} from '../../../../packages/coordination/src/index.js';
import { dataPlugin } from '../../../../packages/data/src/index.js';
import { databaseSetupPlugin } from '../../src/index.js';

export const suite = { owner: 'db-app', level: 'integration', tags: ['postgresql'] } as const;

const databaseUrl = process.env.ARC_TEST_DATABASE_URL;
const remote = 'https://example.com/sqlite-import-fixture.git';

async function database(t: TestContext) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  t.after(() => client.end());
  const context = new Context();
  await context.use(databaseSetupPlugin(client));
  return { client, setup: context.databaseSetup };
}

function source(t: TestContext) {
  const storage = mkdtempSync(join(tmpdir(), 'arcnexus-706-sqlite-'));
  const coordination = new Coordination(storage);
  const journal = coordination.admit(remote, 'Unfinished fixture');
  assert.ok('record' in journal);
  t.after(() => {
    journal.close();
    rmSync(storage, { recursive: true, force: true });
  });
  for (let index = 0; index < 12; index++) journal.record({ observation: index });
  journal.record({ question: 'Approve?', proposal: 'exact bytes', answer: 'Approved' });
  return { storage, journal, coordination };
}

async function scopedReplay(client: Client, task: string, cursor: string) {
  const context = new Context();
  const scope = { principal: 'fixture', project: 'imported' };
  await context.use(dataPlugin((access) => access.scope.project === scope.project));
  await context.use(importedCoordinationDataPlugin(client, () => remote));
  return context.data.invoke(scope, 'execution-events', 'read', {
    execution: task,
    after: { project: scope.project, execution: task, sequence: cursor },
  });
}

test(
  'PostgreSQL setup and rehearsal retain a verified unfinished SQLite journal',
  { skip: !databaseUrl },
  async (t) => {
    const { client, setup } = await database(t);
    const { storage, journal, coordination } = source(t);
    await setup.migrate();
    await setup.migrate();
    const first = await setup.rehearseImport(storage, remote);
    assert.deepEqual(first.rows, { runs: 1, rounds: 0, events: 13 });
    assert.deepEqual(await setup.rehearseImport(storage, remote), first);
    const sourceReplay = coordination.readTaskTimeline(remote, journal.taskID);
    const replay = await readImportedTimeline(client, remote, journal.taskID);
    assert.deepEqual(replay, sourceReplay);
    const cursor = replay.events[0]!.sequence;
    const continuation = { after: cursor };
    assert.deepEqual(
      await readImportedTimeline(client, remote, journal.taskID, continuation),
      coordination.readTaskTimeline(remote, journal.taskID, continuation),
    );
    assert.deepEqual(await scopedReplay(client, journal.taskID, cursor), {
      events: replay.events.slice(1),
      through: { project: 'imported', execution: journal.taskID, sequence: replay.through },
    });
    await assert.rejects(
      readImportedTimeline(client, remote, 'another-task', continuation),
      /cursor is unavailable/,
    );
    journal.record({ reply: 'New source content' });
    await assert.rejects(setup.rehearseImport(storage, remote), /Another SQLite snapshot/);
  },
);
