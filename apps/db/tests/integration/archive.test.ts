import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Context } from 'cordis';
import { Client } from 'pg';
import {
  Coordination,
  readOperationEvidence,
} from '../../../../packages/coordination/src/index.js';
import { databaseSetupPlugin, verifyPlatformDatabase } from '../../src/index.js';
import { databaseArchives } from '../../src/archive.js';

export const suite = {
  owner: 'db-app',
  level: 'integration',
  tags: ['postgresql', 'archive'],
} as const;
const configured = process.env.ARC_TEST_ARCHIVE === '1';
const remote = 'https://github.com/example/restored.git';
const toolInput = { input: { path: 'fixture.md' } };

async function connect(database: string) {
  const secret = process.env.ARC_DB_PASSWORD_FILE;
  const password = secret ? (await readFile(secret, 'utf8')).trim() : undefined;
  const client = new Client({ database, password });
  await client.connect();
  return client;
}

test(
  'the DB archive restores retained commands and requires an empty matching destination',
  { skip: !configured },
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'arc-db-archive-'));
    const admin = await connect('postgres');
    const source = 'source_' + randomUUID().replaceAll('-', '');
    const target = 'target_' + randomUUID().replaceAll('-', '');
    t.after(async () => {
      for (const name of [source, target])
        await admin.query('DROP DATABASE ' + name + ' WITH (FORCE)');
      await admin.end();
      await rm(root, { recursive: true, force: true });
    });
    for (const name of [source, target]) await admin.query('CREATE DATABASE ' + name);
    const staged = await connect(source);
    const storage = join(root, 'journal');
    const evidence = await seed(staged, storage);
    await staged.end();
    await exerciseRestore(root, source, target, storage, evidence);
  },
);

interface Reference {
  execution: string;
  sequence: string;
}

async function exerciseRestore(
  root: string,
  source: string,
  target: string,
  storage: string,
  evidence: Reference,
) {
  const snapshot = join(root, 'state-snapshot');
  await cp(storage, snapshot, { recursive: true });
  const location = join(root, 'archive');
  const archives = databaseArchives(verifyPlatformDatabase);
  await archives.backup(source, location, 'fixture-host-state');
  await assert.rejects(archives.restore(target, location, 'other-state'), /snapshot/);
  await archives.restore(target, location, 'fixture-host-state');
  await rm(storage, { recursive: true });
  await cp(snapshot, storage, { recursive: true });
  await checkRestored(target, storage, evidence);
  await assert.rejects(archives.restore(target, location, 'fixture-host-state'), /empty/);
}

async function seed(database: Client, storage: string) {
  const context = new Context();
  await context.use(databaseSetupPlugin(database));
  await context.databaseSetup.migrate();
  const first = new Coordination(storage).admit(remote, 'Fixture baseline');
  assert.ok('record' in first);
  const file = join(storage, 'tool-input.json');
  await writeFile(file, JSON.stringify(toolInput));
  first.record({ artifact: file });
  const call = first.record({
    operation: { source: file, phase: 'call', call: 'restored-fixture' },
  });
  first.finish({ kind: 'satisfied' });
  first.close();
  await context.databaseSetup.cutover(storage, remote);
  await database.query(
    `
    INSERT INTO arcnexus_coordination.workflow_requests (id,project,principal,request,revision,state,gate)
    VALUES ($1,$2,'architect','{"command":"task_plan"}','pinned','waiting','{"id":"held","question":"Approve?"}')
  `,
    [randomUUID(), remote],
  );
  return { execution: first.taskID, sequence: call.sequence };
}

async function checkRestored(target: string, storage: string, { execution, sequence }: Reference) {
  const database = await connect(target);
  try {
    const { rows } = await database.query(
      'SELECT state, gate FROM arcnexus_coordination.workflow_requests',
    );
    assert.deepEqual(rows, [{ state: 'waiting', gate: { id: 'held', question: 'Approve?' } }]);
    assert.deepEqual(await readOperationEvidence(database, remote, execution, sequence, storage), {
      entries: [toolInput],
    });
  } finally {
    await database.end();
  }
}
