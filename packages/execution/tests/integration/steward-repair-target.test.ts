import assert from 'node:assert/strict';
import test from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type TaskContext } from '../../../architecture/src/index.js';
import { steward } from '../../src/index.js';
import { TestingRewindFixture, rewindMilestone } from '../fixtures/testing-rewind.js';

for (const target of ['implementation', 'documentation'] as const) {
  test(`unavailable Testing repair to ${target} returns to the same caller before progression`, async (t) => {
    const fixture = new TestingRewindFixture(t, false);
    const before = JSON.stringify(fixture.task.history());
    const replies = t.mock.method(
      fixture.task,
      'activate',
      async (_agent: Agent, _selection: unknown, input: TaskContext) => {
        const assignment = input.assignment as { responseRepair?: string };
        if (!assignment.responseRepair)
          return { kind: 'repair', activity: target, reason: 'Fix it locally' };
        assert.match(assignment.responseRepair, /Unavailable local repair/);
        assert.match(assignment.responseRepair, /available.*testing/i);
        return { kind: 'completed', edits: [], checks: [] };
      },
    );
    const result = await steward(
      new Agent(new Architecture()),
      fixture.task,
      rewindMilestone,
      'testing',
      new AbortController().signal,
    );
    assert.equal(result.kind, 'completed');
    assert.equal(replies.mock.callCount(), 2);
    assert.equal(
      JSON.stringify(fixture.task.history().filter((event) => !('stewardRepair' in event))),
      before,
    );
  });
}
