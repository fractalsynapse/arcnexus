import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { deliveryStatus } from '../../../../dist/library/coordination-store/delivery-types.js';
import { DeliveryStore } from '../../../../dist/library/coordination-store/delivery-store.js';
import type {
  DeliveryCapture,
  DeliveryMilestone,
} from '../../../../dist/library/coordination-store/delivery-types.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises immutable capture, approval and publication state without fabricating provider execution. */
class DeliveryFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-delivery-'));

  readonly store = new DeliveryStore(join(this.root, 'delivery.sqlite'));

  readonly capture: DeliveryCapture = {
    id: 'delivery',
    projectId: 'project',
    packageId: 'package',
    runId: 'run',
    assignmentIds: ['assignment'],
    environment: { id: 'simulation', mode: 'simulation' },
    authorityDigest: 'authority',
    base: 'base',
    candidate: 'candidate',
    verification: { references: ['retained-review'], digest: 'evidence-hash' },
    target: { repository: 'owner/repository', branch: 'staging' },
  };

  /** Removes only fixture-owned state after closing SQLite. */
  constructor(t: TestContext) {
    t.after(() => {
      this.store.close();
      rmSync(this.root, { recursive: true, force: true });
    });
  }

  /** Supplies synthetic receipt identities only at the store boundary for deterministic acceptance. */
  advance(milestone: DeliveryMilestone) {
    return this.store.complete(
      'delivery',
      this.store.get('delivery').version,
      milestone,
      'effect-' + milestone,
    );
  }
}

test('delivery capture and approval cannot replace immutable engineering evidence', (t) => {
  const f = new DeliveryFixture(t);
  const initial = f.store.capture(f.capture);
  assert.deepEqual(f.store.capture(f.capture), initial);
  assert.throws(() => f.store.capture({ ...f.capture, candidate: 'changed' }), /attribution/);
  assert.throws(
    () => f.store.approve(initial.id, initial.version, 'changed'),
    /candidate mismatch/,
  );
  const approved = f.store.approve(initial.id, initial.version, initial.candidate);
  assert.equal(deliveryStatus(approved).delivery, 'retained');
  assert.equal(deliveryStatus(approved).integration, 'not_requested');
  assert.equal(deliveryStatus(approved).publication, 'not_requested');
  assert.throws(() => f.store.approve(initial.id, initial.version, initial.candidate), /Stale/);
  assert.deepEqual(f.store.approve(approved.id, approved.version, approved.candidate), approved);
});

test('publication milestones preserve ordering, idempotency and distinct outcomes', (t) => {
  const f = new DeliveryFixture(t);
  f.store.capture(f.capture);
  assert.throws(() => f.advance('merge'), /out of order/);
  f.advance('commit');
  f.advance('push');
  const pending = f.advance('pull_request');
  assert.equal(pending.engineering, 'verified');
  assert.equal(deliveryStatus(pending).integration, 'pending');
  assert.equal(deliveryStatus(pending).publication, 'not_requested');
  assert.deepEqual(f.advance('pull_request'), pending);
  f.advance('merge');
  const published = f.advance('release');
  assert.equal(deliveryStatus(published).publication, 'released');
  assert.throws(
    () => f.store.complete(published.id, published.version, 'release', 'other-effect'),
    /cannot change/,
  );
});

test('real releases remain prohibited and failures do not erase completed milestones', (t) => {
  const f = new DeliveryFixture(t);
  f.store.capture({ ...f.capture, environment: { id: 'live', mode: 'live' } });
  for (const step of ['commit', 'push', 'pull_request', 'merge'] as const) f.advance(step);
  assert.throws(() => f.advance('release'), /not authorized/);
  const merged = f.store.get('delivery');
  const blocked = f.store.block(merged.id, merged.version, 'Human-controlled publication required');
  assert.equal(deliveryStatus(blocked).integration, 'merged');
  assert.equal(deliveryStatus(blocked).publication, 'not_requested');
});

test('missing evidence and simulated promotion fail before capture', (t) => {
  const f = new DeliveryFixture(t);
  assert.throws(
    () => f.store.capture({ ...f.capture, verification: { references: [], digest: '' } }),
    /verification/,
  );
  assert.deepEqual(f.store.list(), []);
});

registerSuite({
  component: 'coordination-store',
  level: 'integration',
  tags: ['deterministic', 'lifecycle-effects'],
});
