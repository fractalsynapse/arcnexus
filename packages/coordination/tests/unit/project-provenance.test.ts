import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Coordination, Journal } from '../../src/index.js';

test('project provenance follows the actual journal database rather than a service instance', (t) => {
  const storage = mkdtempSync(join(tmpdir(), 'arcnexus-provenance-'));
  t.after(() => rmSync(storage, { recursive: true, force: true }));
  const remote = 'https://example.invalid/project.git';
  const store = new Coordination(storage);
  const journal = store.admit(remote, 'Assess architecture');
  assert(journal instanceof Journal);
  t.after(() => journal.close());
  assert.equal(new Coordination(storage).owns(remote, journal), true);
  assert.equal(store.owns('https://example.invalid/other.git', journal), false);
  assert.equal(new Coordination(join(storage, 'other')).owns(remote, journal), false);
  const child = journal.child('Implement approved prerequisite', 'prerequisite');
  assert(child instanceof Journal);
  assert.equal(store.owns(remote, child), true);
  child.finish({ kind: 'merged' });
  journal.finish({ kind: 'planned' });
});
