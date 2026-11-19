import assert from 'node:assert/strict';
import test from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type TaskContext } from '../../../architecture/src/index.js';
import { steward } from '../../src/index.js';
import type { TaskEvent } from '../../../workflow/src/index.js';
import { TestingRewindFixture, rewindMilestone } from '../fixtures/testing-rewind.js';

/** Permit diagnostic artifacts while refusing plan, cursor or activation changes during reply repair. */
function responseEvidence(event: TaskEvent) {
  return 'artifact' in event || 'stewardRepair' in event;
}

for (const target of ['implementation', 'documentation'] as const) {
  test(`unavailable Testing repair to ${target} returns to the same caller before progression`, async (t) => {
    const fixture = new TestingRewindFixture(t, false);
    const before = fixture.task.history().slice();
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
    const history = fixture.task.history();
    assert.deepEqual(history.slice(0, before.length), before);
    assert(history.slice(before.length).every(responseEvidence));
  });
}
