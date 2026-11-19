import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type TaskContext } from '../../../architecture/src/index.js';
import { steward } from '../../src/index.js';
import type { TaskEvent } from '../../../workflow/src/index.js';
import type { TestContext } from 'node:test';
import { TestingRewindFixture, rewindMilestone } from '../fixtures/testing-rewind.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['recovery'] } as const;

/** Exercise caller response correction without a redundant Workflow transition or another owner. */
class SelfRepairScenario {
  readonly fixture: TestingRewindFixture;
  calls = 0;

  /** Use the existing real journal, captured scope and checked-edit fixture. */
  constructor(
    t: TestContext,
    private readonly repeated = false,
  ) {
    this.fixture = new TestingRewindFixture(t, false);
    this.fixture.activity = 'implementation';
    t.mock.method(
      this.fixture.task,
      'activate',
      async (_agent: Agent, _selection: unknown, input: TaskContext) => this.respond(input),
    );
  }

  /** Correct a rejected response in the caller instead of recording a self-rewind. */
  private respond(input: TaskContext) {
    this.calls++;
    const assignment = input.assignment as { repairTargets: string[]; responseRepair?: string };
    if (this.calls === 1 || this.repeated)
      return { kind: 'repair', activity: 'implementation', reason: 'Assigned work remains' };
    assert(!assignment.repairTargets.includes('implementation'));
    assert.match(
      assignment.responseRepair!,
      /Unavailable local repair.*Finish the current activity/,
    );
    this.fixture.task.edits('owner', 'implementation', [
      { path: 'fixture.txt', expected: null, content: 'Corrected within the original caller' },
    ]);
    return { kind: 'completed', edits: [], checks: [] };
  }

  /** Drive the public steward and keep the host-generated check path unchanged. */
  run() {
    return steward(
      new Agent(new Architecture()),
      this.fixture.task,
      rewindMilestone,
      'implementation',
      AbortSignal.timeout(5000),
    );
  }
}

test('model self-repair returns its exact diagnostic to the caller, which makes its checked correction', async (t) => {
  const scenario = new SelfRepairScenario(t);
  assert.equal((await scenario.run()).kind, 'completed');
  assert.equal(scenario.calls, 2);
  assert.equal(
    readFileSync(join(scenario.fixture.root, 'fixture.txt'), 'utf8'),
    'Corrected within the original caller',
  );
  assert.equal(scenario.fixture.task.history().filter((event) => 'activation' in event).length, 0);
});

test('an unchanged invalid self-repair uses the existing durable reply hold', async (t) => {
  const scenario = new SelfRepairScenario(t, true);
  const result = await scenario.run();
  assert.equal(result.kind, 'blocked');
  assert.equal(scenario.calls, 2);
  assert.match(result.kind === 'blocked' ? result.reason : '', /Steward reply repair failed/);
});

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
        assert.match(assignment.responseRepair, /available.*none/i);
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
