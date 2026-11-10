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
    route: {
      head: 'h',
      receipt: 'e4',
      integratedAt: 'now',
      released: false,
      releaseExpected: false,
    },
  });
  assert.equal(outstandingRoute([integrated], 'project', 'env'), undefined);
});

test('a route that declared a release still owes it until it is recorded', () => {
  const owed = stuck({
    environment: { id: 'env', mode: 'simulation' },
    route: {
      head: 'h',
      receipt: 'e4',
      integratedAt: 'now',
      released: false,
      releaseExpected: true,
    },
  });
  assert.equal(outstandingRoute([owed], 'project', 'env')?.id, 'delivery-a');
  const settled = stuck({
    environment: { id: 'env', mode: 'simulation' },
    route: { head: 'h', receipt: 'e4', integratedAt: 'now', released: true, releaseExpected: true },
  });
  assert.equal(
    outstandingRoute([settled], 'project', 'env'),
    undefined,
    'the namespace closes once the declared release is recorded',
  );
});

const settledRoute = {
  head: 'h',
  receipt: 'e4',
  integratedAt: 'now',
  released: false,
  releaseExpected: false,
};

test('a route declaring no release ends at the merge identity', () => {
  assert.equal(outstandingRoute([stuck({ route: settledRoute })], 'project', 'env'), undefined);
});

test('the same recorded route means the same thing in either namespace', () => {
  const simulated = stuck({ environment: { id: 'env', mode: 'simulation' }, route: settledRoute });
  assert.equal(outstandingRoute([simulated], 'project', 'env'), undefined);
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
