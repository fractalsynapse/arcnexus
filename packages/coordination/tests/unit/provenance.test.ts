import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test, { type TestContext } from 'node:test';
import { Coordination, Journal } from '../../src/index.js';

const remote = 'https://example.invalid/provenance.git';

/** Create an admitted writer and retain its store for public provenance checks. */
function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'arcnexus-provenance-'));
  const store = new Coordination(directory);
  const root = store.admit(remote, 'Architect');
  assert(root instanceof Journal);
  t.after(() => {
    root.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, store, root };
}

test('the issuing Coordination recognizes its root and descendants', (t) => {
  const { store, root } = fixture(t);
  const child = root.child('Prerequisite', 'implementation');
  assert(child instanceof Journal);
  assert.equal(store.owns(root, remote), true);
  assert.equal(store.owns(child, remote), true);
  child.finish({ kind: 'merged' });
  root.finish({ kind: 'planned' });
});

test('a manually constructed Journal and copied prototype cannot establish provenance', (t) => {
  const { store, root } = fixture(t);
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  const constructed = new Journal(database, root.run, root.goal);
  const copied = Object.assign(Object.create(Journal.prototype) as Journal, root);
  assert.equal(store.owns(constructed, remote), false);
  assert.equal(store.owns(copied, remote), false);
  root.finish({ kind: 'planned' });
});

test('another Coordination instance using the same store cannot claim the writer', (t) => {
  const { directory, store, root } = fixture(t);
  const other = new Coordination(directory);
  assert.equal(other.owns(root, remote), false);
  assert.equal(store.owns(root, remote), true);
  root.finish({ kind: 'planned' });
});

test('a Journal from a different store is foreign', (t) => {
  const { store, root } = fixture(t);
  const other = fixture(t);
  assert.equal(store.owns(other.root, remote), false);
  assert.equal(other.store.owns(root, remote), false);
  other.root.finish({ kind: 'planned' });
  root.finish({ kind: 'planned' });
});

test('a different project remote cannot claim the writer', (t) => {
  const { store, root } = fixture(t);
  assert.equal(store.owns(root, 'https://example.invalid/other.git'), false);
  root.finish({ kind: 'planned' });
});
