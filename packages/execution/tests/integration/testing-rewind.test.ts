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
    .observations<{ checkExpectationRepair?: { log: string; redLog: string } }>()
    .findLast((v) => v.checkExpectationRepair)?.checkExpectationRepair;
  assert.equal(event?.log, mistaken.log);
  assert.equal(event?.redLog, fixture.red);
});

test('initial Testing cannot change expected-red after a passing result without completed Implementation', async (t) => {
  const fixture = new TestingRewindFixture(t, false);
  await fixture.connect();
  await fixture.call('fail');
  assert((await fixture.call('pass')).isError);
  assert.equal(fixture.task.pendingCheck(fixture.scope)?.expected, 'fail');
});

test('a failed required-pass observation cannot be changed to expected-red after a rewind', async (t) => {
  const fixture = new TestingRewindFixture(t);
  fixture.status = 37;
  await fixture.connect();
  await fixture.call('pass');
  assert((await fixture.call('fail')).isError);
  assert.equal(fixture.task.pendingCheck(fixture.scope)?.expected, 'pass');
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
  await fixture.connect();
  assert(!(await fixture.call('pass')).isError);
  assert.equal(fixture.task.pendingCheck(fixture.scope), undefined);
});

for (const invalid of [
  'authority',
  'acceptance',
  'missing-log',
  'missing-green',
  'no-red',
] as const) {
  test(`prior red cannot authorize expectation repair after ${invalid}`, async (t) => {
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
    await fixture.connect();
    await fixture.call('fail');
    assert((await fixture.call('pass')).isError);
    assert.equal(fixture.task.pendingCheck(fixture.scope)?.expected, 'fail');
  });
}
