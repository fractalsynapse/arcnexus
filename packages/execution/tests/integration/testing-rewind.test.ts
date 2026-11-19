import assert from 'node:assert/strict';
import { readFileSync, unlinkSync } from 'node:fs';
import test from 'node:test';
import { TestingRewindFixture, rewindMilestone } from '../fixtures/testing-rewind.js';

test('rewound Testing sees prior completion and real original red without changing the current cursor', async (t) => {
  const fixture = new TestingRewindFixture(t);
  const context = await fixture.context();
  assert.deepEqual(context.completedActivities, ['documentation']);
  assert.deepEqual(context.previouslyCompletedActivities, ['testing', 'implementation']);
  assert.equal(context.retainedTesting.redLog, fixture.red);
  assert.equal(context.retainedTesting.completedImplementation, true);
  assert.match(context.repair, /characterize with expected pass/);
});

test('MCP corrects a repeated-red expectation using prior red and requires a new actual passing observation', async (t) => {
  const fixture = new TestingRewindFixture(t);
  await fixture.connect();
  assert(!(await fixture.call('fail')).isError);
  const mistaken = fixture.task.pendingCheck(fixture.scope)!;
  assert.equal(mistaken.status, 0);
  const corrected = await fixture.call('pass');
  assert(!corrected.isError, JSON.stringify(corrected));
  assert.equal(fixture.task.pendingCheck(fixture.scope), undefined);
  assert.equal(readFileSync(mistaken.log, 'utf8'), 'passed');
  const event = fixture.task
    .observations<{ checkExpectationRepair?: { log: string } }>()
    .findLast((v) => v.checkExpectationRepair)?.checkExpectationRepair;
  assert.equal(event?.log, mistaken.log);
  assert.equal(readFileSync(fixture.red, 'utf8'), 'not ok 1 - original regression');
});

test('correcting a caller prediction records only actual passes and never invents initial red', async (t) => {
  const fixture = new TestingRewindFixture(t, false, 0);
  await fixture.connect();
  await fixture.call('fail');
  assert(!(await fixture.call('pass')).isError);
  assert.equal(fixture.task.pendingCheck(fixture.scope), undefined);
  const observations = fixture.task.observations<{ check?: { status: number } }>();
  assert(observations.filter((event) => event.check).every((event) => event.check!.status === 0));
});

test('Implementation can correct an unexpected-pass prediction after completed Testing without breaking passing code', async (t) => {
  const fixture = new TestingRewindFixture(t, false);
  fixture.activity = 'implementation';
  fixture.task.record({
    activation: {
      milestone: 'original',
      owner: 'owner',
      index: 1,
      step: 'testing',
      outcome: { kind: 'completed', evidence: [fixture.red] },
    },
  });
  fixture.task.record({ position: { completed: 0, activities: { original: 2 } } });
  const before = JSON.stringify(fixture.task.history().findLast((event) => 'plan' in event));
  await fixture.connect();
  await fixture.call('fail');
  const corrected = await fixture.call('pass');
  assert(!corrected.isError, JSON.stringify(corrected));
  assert.equal(fixture.task.pendingCheck(fixture.scope), undefined);
  assert.equal(JSON.stringify(fixture.task.history().findLast((event) => 'plan' in event)), before);
});

test('a failed required-pass observation cannot be changed to expected-red after a rewind', async (t) => {
  const fixture = new TestingRewindFixture(t);
  fixture.status = 37;
  await fixture.connect();
  await fixture.call('pass');
  assert((await fixture.call('fail')).isError);
  assert.equal(fixture.task.pendingCheck(fixture.scope)?.expected, 'pass');
});

test('unexpected-pass context tells Implementation to correct its prediction without breaking code', async (t) => {
  const fixture = new TestingRewindFixture(t, false);
  fixture.activity = 'implementation';
  fixture.observation('implementation', 'fail', 0);
  const context = await fixture.context();
  assert.equal(context.failedCheck.status, 0);
  assert.match(context.correction, /actual check passed/);
  assert.match(context.correction, /expected pass/);
  assert.doesNotMatch(context.correction, /original expectation/);
});

test('a correction still requires a passing result when current inputs fail', async (t) => {
  const fixture = new TestingRewindFixture(t);
  await fixture.connect();
  await fixture.call('fail');
  fixture.status = 37;
  await fixture.call('pass');
  assert.equal(fixture.task.pendingCheck(fixture.scope)?.status, 37);
  assert.equal(fixture.task.pendingCheck(fixture.scope)?.expected, 'pass');
  assert((await fixture.call('fail')).isError);
});

test('interruption after expectation correction retains the required passing recheck for restart', async (t) => {
  const fixture = new TestingRewindFixture(t);
  await fixture.connect();
  await fixture.call('fail');
  fixture.interrupted = true;
  assert((await fixture.call('pass')).isError);
  assert.equal(fixture.task.pendingCheck(fixture.scope)?.expected, 'pass');
  await fixture.restart();
  fixture.interrupted = false;
  const context = await fixture.context();
  assert.match(context.correction, /passing recheck remains pending/);
  assert.equal(fixture.task.pendingCheck(fixture.scope), undefined);
});

for (const invalid of [
  'authority',
  'acceptance',
  'missing-log',
  'missing-green',
  'no-red',
] as const) {
  test(`context never claims valid prior red after ${invalid}`, async (t) => {
    const fixture = new TestingRewindFixture(t, true, invalid === 'no-red' ? 0 : 37);
    if (invalid === 'authority')
      Object.assign(fixture.task.capture.source, { revision: 'changed' });
    if (invalid === 'missing-log') unlinkSync(fixture.red);
    if (invalid === 'missing-green') unlinkSync(fixture.green);
    if (invalid === 'acceptance') {
      const milestone = structuredClone(rewindMilestone);
      milestone.criteria = [{ id: 'fixed', description: 'Different requirement' }];
      fixture.task.record({
        plan: {
          focus: { purpose: 'Changed', objectives: [], constraints: [] },
          milestones: [milestone],
        },
      });
    }
    const context = await fixture.context();
    assert.equal(context.retainedTesting, undefined);
  });
}
