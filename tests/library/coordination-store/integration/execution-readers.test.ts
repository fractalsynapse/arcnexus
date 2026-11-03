import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Retains actual SQLite connections to prove read enforcement and snapshot isolation. */
class ReaderFixture {
  readonly directory = mkdtempSync(join(tmpdir(), 'arcnexus-execution-readers-'));

  readonly path = join(this.directory, 'execution.sqlite');

  /** Removes only this test's private evidence after all connections have closed. */
  constructor(t: TestContext) {
    t.after(() => rmSync(this.directory, { recursive: true, force: true }));
  }
}

test('read-only execution stores cannot create absent databases or append transitions', (t) => {
  const f = new ReaderFixture(t);
  assert.throws(() => new ExecutionStore(f.path, true));
  assert.equal(existsSync(f.path), false);
  const writer = new ExecutionStore(f.path);
  const run = writer.createRun('task', ['owner'], 'Retain evidence');
  writer.close();
  const reader = new ExecutionStore(f.path, true);
  try {
    assert.throws(() => reader.updateRun(run.id, 'cancelled'), /readonly|read-only/i);
    assert.equal(reader.run(run.id).status, 'running');
    assert.equal(reader.events().length, 1);
  } finally {
    reader.close();
  }
});

test('read snapshots remain consistent while the host commits a later transition', (t) => {
  const f = new ReaderFixture(t);
  const writer = new ExecutionStore(f.path);
  const run = writer.createRun('task', ['owner'], 'Retain evidence');
  const reader = new ExecutionStore(f.path, true);
  try {
    reader.snapshot(() => {
      assert.equal(reader.run(run.id).status, 'running');
      writer.updateRun(run.id, 'paused');
      assert.equal(reader.run(run.id).status, 'running');
      assert.equal(reader.events().length, 1);
    });
    assert.equal(reader.run(run.id).status, 'paused');
    assert.equal(reader.events().length, 2);
  } finally {
    reader.close();
    writer.close();
  }
});

test('read-only general execution rejects legacy databases without migration', (t) => {
  const f = new ReaderFixture(t);
  const legacy = new DatabaseSync(f.path);
  legacy.exec('CREATE TABLE old_evidence(value TEXT); PRAGMA user_version=1;');
  legacy.close();
  const before = readFileSync(f.path);
  assert.throws(() => new ExecutionStore(f.path, true), /version/);
  assert.deepEqual(readFileSync(f.path), before);
});

registerSuite({ component: 'coordination-store', level: 'integration', tags: ['deterministic'] });
