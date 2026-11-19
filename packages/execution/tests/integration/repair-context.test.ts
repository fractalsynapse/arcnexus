import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type TaskContext } from '../../../architecture/src/index.js';
import { activities, type Milestone } from '../../../direction/src/index.js';
import { steward } from '../../src/index.js';
import { StewardFixture } from '../fixtures/steward.js';

const milestone: Milestone = {
  id: 'original',
  owner: 'owner',
  criteria: [{ id: 'fixed', description: 'Repair the regression' }],
  steps: activities.map((activity) => ({ activity, checklist: [] })),
};

/** Record an interrupted rewind and optionally its completed target without fabricating a new plan. */
function repairedTask(t: TestContext, completed: boolean) {
  const task = new StewardFixture(t, mkdtempSync(join(tmpdir(), 'arcnexus-repair-context-'))).task;
  t.after(() => task.close());
  task.record({
    position: { completed: 0, activities: { original: 1 } },
    repair: {
      milestone: 'original',
      activity: 'testing',
      reason: 'Add missing regression',
      evidence: [],
    },
  });
  if (completed) task.record({ position: { completed: 0, activities: { original: 2 } } });
  return task;
}

for (const completed of [false, true]) {
  test(`repair context identifies whether the rewind target has completed: ${completed}`, async (t) => {
    const task = repairedTask(t, completed);
    t.mock.method(
      task,
      'activate',
      async (_agent: Agent, _selection: unknown, data: TaskContext) => {
        const context = data.assignment as {
          completedActivities: string[];
          localRepair: { targetCompleted: boolean };
        };
        assert.equal(context.localRepair.targetCompleted, completed);
        assert.deepEqual(
          context.completedActivities,
          completed ? ['documentation', 'testing'] : ['documentation'],
        );
        return { kind: 'completed', edits: [], checks: [] };
      },
    );
    const result = await steward(
      new Agent(new Architecture()),
      task,
      milestone,
      completed ? 'implementation' : 'testing',
      new AbortController().signal,
    );
    assert.equal(result.kind, 'completed');
  });
}
