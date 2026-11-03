import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { LifecycleStore } from '../../../../dist/library/coordination-store/lifecycle-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Keeps lifecycle evidence in a real SQLite database across connection replacement. */
class LifecycleFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'anx-lifecycle-'));

  readonly path = join(this.root, 'lifecycle.sqlite');

  readonly store = new LifecycleStore(this.path);

  readonly intent = {
    id: 'effect',
    environmentId: 'simulation',
    runId: 'run',
    assignmentId: 'assignment',
    operation: 'issue.create',
    target: 'repo',
    definitionDigest: 'definition',
    input: { title: 'Useful work', body: 'Acceptance criteria' },
  };

  /** Captures immutable authority and removes only private test evidence after closure. */
  constructor(t: TestContext) {
    this.store.register({
      id: 'simulation',
      mode: 'simulation',
      repositoryId: 'repo',
      providerId: 'provider',
      authorityDigest: 'authority',
    });
    t.after(() => {
      this.store.close();
      rmSync(this.root, { recursive: true, force: true });
    });
  }
}

test('environment identity cannot change mode, repository or authority', (t) => {
  const f = new LifecycleFixture(t);
  const original = f.store.environment('simulation');
  for (const change of [
    { mode: 'live' as const },
    { repositoryId: 'other' },
    { authorityDigest: 'replacement' },
  ])
    assert.throws(() => f.store.register({ ...original, ...change }), /cannot change/);
  assert.deepEqual(f.store.environment('simulation'), original);
});

test('effect retries preserve intent and do not create a second attempt', (t) => {
  const f = new LifecycleFixture(t);
  const first = f.store.prepare(f.intent);
  assert.deepEqual(
    f.store.prepare({ ...f.intent, input: { body: 'Acceptance criteria', title: 'Useful work' } }),
    first,
  );
  assert.throws(() => f.store.prepare({ ...f.intent, assignmentId: 'other' }), /different intent/);
  const started = f.store.begin(first.id);
  assert.throws(() => f.store.begin(first.id), /reconciliation/);
  f.store.complete(started.id, started.attempt, { issue: 1 });
  assert.equal(f.store.prepare(f.intent).status, 'completed');
  assert.equal(f.store.effect(first.id).attempt, 1);
});

test('uncertain effects survive reopening and unknown observations never authorize retry', (t) => {
  const f = new LifecycleFixture(t);
  const started = f.store.begin(f.store.prepare(f.intent).id);
  const reopened = new LifecycleStore(f.path);
  try {
    assert.equal(reopened.effect(started.id).status, 'uncertain');
    reopened.reconcile(started.id, 1, { status: 'unknown', evidence: 'Provider unavailable' });
    assert.throws(() => reopened.begin(started.id), /reconciliation/);
    reopened.reconcile(started.id, 1, { status: 'absent', evidence: 'Confirmed absent' });
    const retried = reopened.begin(started.id);
    assert.equal(retried.attempt, 2);
    assert.throws(() => reopened.complete(started.id, 1, {}), /Stale/);
    reopened.complete(started.id, 2, { issue: 1 });
  } finally {
    reopened.close();
  }
});

test('read-only lifecycle inspection cannot register environments or alter effects', (t) => {
  const f = new LifecycleFixture(t);
  f.store.prepare(f.intent);
  const reader = new LifecycleStore(f.path, true);
  try {
    assert.equal(reader.effects().length, 1);
    assert.throws(() => reader.begin(f.intent.id), /readonly|read-only/i);
    assert.equal(reader.effect(f.intent.id).status, 'prepared');
  } finally {
    reader.close();
  }
});

registerSuite({ component: 'coordination-store', level: 'integration', tags: ['deterministic', 'lifecycle-effects'] });
