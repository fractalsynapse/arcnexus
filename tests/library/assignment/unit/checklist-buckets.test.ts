import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { updatePlan } from '../../../../dist/library/assignment/plan.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises the canonical activity bucket order through the public checklist interface. */
class BucketScenarios {
  private readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-buckets-'));

  /** One checklist item claimed pending, as every accepted plan starts. */
  private static item(id: string, activity: string) {
    return {
      id,
      activity,
      result: `${id} is observed complete`,
      criteria: [0],
      expectedEvidence: ['evidence:report'],
      dependencies: [],
      status: 'pending',
      evidence: [],
      explanation: '',
    };
  }

  /** The full supported activity sequence, so only item placement distinguishes the scenarios. */
  private static buckets() {
    return [
      { activity: 'research', reason: 'Establish what the interface already promises' },
      { activity: 'documentation', reason: 'Record the changed intent' },
      { activity: 'testing', reason: 'Characterize behavior before changing it' },
      { activity: 'implementation', reason: 'Make the change owned by this component' },
      { activity: 'review', reason: 'One independent verdict against the criteria' },
      { activity: 'release', reason: 'Deliver through the one route' },
    ];
  }

  /** One research item and one release item, both open, in canonical bucket order. */
  private record(t: TestContext): any {
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
    return {
      id: 'assignment',
      startedAt: new Date(0).toISOString(),
      commands: [],
      activities: [],
      plan: {
        approach: 'Investigate, then deliver',
        assumptions: [],
        questions: [],
        version: 1,
        activities: BucketScenarios.buckets(),
        items: [
          BucketScenarios.item('investigate', 'research'),
          BucketScenarios.item('integrate', 'release'),
        ],
      },
    };
  }

  /** EX-20: an item in a later bucket cannot advance while an earlier one is open. */
  refusesLaterBucket(t: TestContext): void {
    const record = this.record(t);
    assert.throws(
      () =>
        updatePlan(this.root, record, [
          { id: 'integrate', status: 'completed', explanation: 'delivered', evidence: ['e:1'] },
        ]),
      /Bucket order: integrate waits for investigate \(research\)/,
    );
    assert.equal(record.plan.items.find((i: any) => i.id === 'integrate').status, 'pending');
  }

  /** EX-20: closing the earlier bucket opens the next one in the same call sequence. */
  advancesAfterEarlierBucketCloses(t: TestContext): void {
    const record = this.record(t);
    updatePlan(this.root, record, [
      {
        id: 'investigate',
        status: 'completed',
        explanation: 'read the contract',
        evidence: ['e:1'],
      },
      { id: 'integrate', status: 'in_progress', explanation: 'assembling', evidence: [] },
    ]);
    assert.equal(record.plan.items.find((i: any) => i.id === 'integrate').status, 'in_progress');
  }

  /** A batch that finishes earlier work first may open the next bucket in the same call. */
  allowsOrderedBatch(t: TestContext): void {
    const record = this.record(t);
    updatePlan(this.root, record, [
      { id: 'investigate', status: 'skipped', explanation: 'already established', evidence: [] },
      { id: 'integrate', status: 'completed', explanation: 'delivered', evidence: ['e:1'] },
    ]);
    assert.equal(record.plan.items.find((i: any) => i.id === 'integrate').status, 'completed');
  }

  /** Terminal statuses free the bucket; a blocked item still holds it open. */
  blockedItemHoldsBucket(t: TestContext): void {
    const record = this.record(t);
    updatePlan(this.root, record, [
      { id: 'investigate', status: 'blocked', explanation: 'awaiting another owner', evidence: [] },
    ]);
    assert.throws(
      () =>
        updatePlan(this.root, record, [
          { id: 'integrate', status: 'completed', explanation: 'delivered', evidence: ['e:1'] },
        ]),
      /waits for investigate/,
    );
  }
}

const scenarios = new BucketScenarios();

test('a later activity bucket cannot open while an earlier bucket holds open work', (t) =>
  scenarios.refusesLaterBucket(t));

test('closing the earlier bucket lets the next bucket advance', (t) =>
  scenarios.advancesAfterEarlierBucketCloses(t));

test('a batch that closes its earlier work first may open the next bucket', (t) =>
  scenarios.allowsOrderedBatch(t));

test('a blocked item holds its bucket closed to later work', (t) =>
  scenarios.blockedItemHoldsBucket(t));

registerSuite({ component: 'assignment', level: 'unit', tags: ['deterministic'] });
