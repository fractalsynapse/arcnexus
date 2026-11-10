import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  outstandingRoute,
  type DeliveryRecord,
} from '../../../../dist/library/coordination-store/delivery-types.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Builds one delivery record with only the fields the route question depends on. */
function record(over: Partial<DeliveryRecord>): DeliveryRecord {
  return {
    id: 'delivery-a',
    projectId: 'project',
    packageId: 'package',
    runId: 'run-a',
    assignmentIds: ['assignment'],
    environment: { id: 'env', mode: 'live' },
    authorityDigest: 'authority',
    base: 'base',
    candidate: 'candidate',
    verification: { references: ['review'], digest: 'digest' },
    target: { repository: 'example/project', branch: 'staging' },
    version: 1,
    createdAt: 'fixture',
    engineering: 'verified',
    receipts: {},
    ...over,
  } as DeliveryRecord;
}

const merged = { commit: 'e1', push: 'e2', pull_request: 'e3', merge: 'e4' };

/** A route that recorded its merge effect but never saw the target move. */
function stuck(over: Partial<DeliveryRecord> = {}): DeliveryRecord {
  return record({ receipts: merged, ...over });
}

test('a verified merge that never reconciled is the outstanding route', () => {
  assert.equal(outstandingRoute([stuck()], 'project', 'env')?.id, 'delivery-a');
});

test('a completed route is not adopted again', () => {
  const integrated = stuck({
    route: { head: 'h', receipt: 'e4', integratedAt: 'now', released: false },
  });
  assert.equal(outstandingRoute([integrated], 'project', 'env'), undefined);
});

test('a simulated route still owes its recorded release', () => {
  const simulated = stuck({
    environment: { id: 'env', mode: 'simulation' },
    route: { head: 'h', receipt: 'e4', integratedAt: 'now', released: false },
  });
  assert.equal(outstandingRoute([simulated], 'project', 'env')?.id, 'delivery-a');
});

test('work that never reached a merge receipt cannot hijack a new run', () => {
  const partial = record({ receipts: { commit: 'e1', push: 'e2' } });
  assert.equal(outstandingRoute([partial], 'project', 'env'), undefined);
});

test('another namespace or project is left alone', () => {
  const other = stuck({ projectId: 'elsewhere' });
  const otherEnv = stuck({ environment: { id: 'other', mode: 'live' } });
  assert.equal(outstandingRoute([other, otherEnv], 'project', 'env'), undefined);
});

test('the oldest outstanding route in the namespace is the one adopted', () => {
  const older = stuck({ id: 'older' });
  const newer = stuck({ id: 'newer', runId: 'run-b' });
  assert.equal(outstandingRoute([older, newer], 'project', 'env')?.id, 'older');
});

registerSuite({ component: 'coordination-store', level: 'unit', tags: ['deterministic'] });
