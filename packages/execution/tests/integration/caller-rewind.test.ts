import assert from 'node:assert/strict';
import test from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type TaskContext } from '../../../architecture/src/index.js';
import { steward } from '../../src/index.js';
import { TestingRewindFixture, rewindMilestone } from '../fixtures/testing-rewind.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['recovery'] } as const;

/** Model a caller choosing the earlier assertion activity only when the host exposes that route. */
function fixtureDecision(input: TaskContext) {
  const assignment = input.assignment as { repairTargets?: string[] };
  if (!assignment.repairTargets?.includes('testing'))
    return { kind: 'blocked', reason: 'Incorrect fixture requires earlier Testing' };
  assert.deepEqual(assignment.repairTargets, ['testing']);
  return {
    kind: 'repair',
    activity: 'testing',
    reason: 'Fixture uses obsolete activity semantics',
  };
}

test('Implementation can select Testing for invalid fixtures without clearing its required passing check', async (t) => {
  const fixture = new TestingRewindFixture(t, false);
  fixture.activity = 'implementation';
  const failure = fixture.observation('implementation', 'pass', 37);
  const before = JSON.stringify(fixture.task.history().findLast((event) => 'plan' in event));
  t.mock.method(
    fixture.task,
    'activate',
    async (_agent: Agent, _selection: unknown, input: TaskContext) => fixtureDecision(input),
  );
  const outcome = await steward(
    new Agent(new Architecture()),
    fixture.task,
    rewindMilestone,
    'implementation',
    AbortSignal.timeout(5000),
  );
  assert.equal(outcome.kind, 'repair');
  assert.equal(outcome.kind === 'repair' && outcome.activity, 'testing');
  assert.equal(fixture.task.pendingCheck(fixture.scope)?.log, failure.log);
  assert.equal(fixture.task.pendingCheck(fixture.scope)?.expected, 'pass');
  assert.equal(JSON.stringify(fixture.task.history().findLast((event) => 'plan' in event)), before);
});

test('self-review repair targets contain only applicable editable activities', async (t) => {
  const fixture = new TestingRewindFixture(t, false);
  Object.assign(fixture.task.capture.components.owner!.activities, {
    review: { profile: 'profile', operations: [] },
  });
  t.mock.method(
    fixture.task,
    'activate',
    async (_agent: Agent, _selection: unknown, input: TaskContext) => {
      const assignment = input.assignment as { repairTargets?: string[] };
      assert.deepEqual(assignment.repairTargets, ['testing', 'implementation']);
      return { kind: 'completed', edits: [], checks: [] };
    },
  );
  assert.equal(
    (
      await steward(
        new Agent(new Architecture()),
        fixture.task,
        rewindMilestone,
        'review',
        AbortSignal.timeout(5000),
      )
    ).kind,
    'completed',
  );
});
