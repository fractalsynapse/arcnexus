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
import { TestingRewindFixture, rewindMilestone } from '../fixtures/testing-rewind.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

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

/** Set up distinct same-milestone repairs with an unrelated finding between them. */
function nestedTask(t: TestContext) {
  const task = new StewardFixture(t, mkdtempSync(join(tmpdir(), 'arcnexus-nested-repair-'))).task;
  t.after(() => task.close());
  const original = {
    milestone: 'original',
    activity: 'testing' as const,
    reason: 'Preserve the entire original requirement: first line\nsecond line, exactly.',
    evidence: ['original-finding.log', 'original-detail.log'],
  };
  const latest = {
    milestone: 'original',
    activity: 'documentation' as const,
    reason: 'Correct the repair diagnostic: distinct wording.',
    evidence: ['latest-repair.log'],
  };
  task.record({ position: { completed: 0, activities: { original: 1 } }, repair: original });
  task.record({
    position: { completed: 0, activities: { original: 0 } },
    repair: { ...latest, milestone: 'unrelated', reason: 'Unrelated milestone finding' },
  });
  task.record({ position: { completed: 0, activities: { original: 0 } }, repair: latest });
  return { task, original, latest };
}

test('nested repairs retain the originating finding and latest diagnostic in the accepted milestone', async (t) => {
  const { task, original, latest } = nestedTask(t);
  t.mock.method(
    task,
    'activate',
    async (_agent: Agent, _selection: unknown, input: TaskContext) => {
      const assignment = input.assignment as { localRepair: unknown };
      assert.deepEqual(assignment.localRepair, {
        ...latest,
        originatingFinding: original,
        targetCompleted: false,
      });
      assert.deepEqual(input.acceptance, milestone.criteria);
      const context = input.assignment as { completedActivities: string[] };
      assert.deepEqual(context.completedActivities, []);
      return { kind: 'completed', edits: [], checks: [] };
    },
  );
  const result = await steward(
    new Agent(new Architecture()),
    task,
    milestone,
    'documentation',
    new AbortController().signal,
  );
  assert.equal(result.kind, 'completed');
});

const latestReplay = {
  milestone: 'original',
  activity: 'testing' as const,
  reason: 'Repair the repair\nwith the complete diagnostic.',
  evidence: ['latest.log'],
};
const originalReplay = {
  milestone: 'original',
  activity: 'documentation' as const,
  reason: 'Correct outdated documentation',
  evidence: [],
};

/** Retain an edit and complete answer artifacts before the second rewind. */
function replayEvidence(fixture: TestingRewindFixture) {
  const receipt = fixture.task.edits('owner', 'testing', [
    { path: 'fixture.txt', expected: null, content: 'retained edit\n' },
  ]);
  const answer = '  Complete clarification\nwith its second line.  ';
  const report = 'Complete research findings\nincluding the final line.\n';
  const evidence = fixture.task.store('research.md', report);
  fixture.task.note({ clarification: { question: 'Which requirement?', answer } });
  fixture.task.note({ researchResult: { evidence } });
  return { receipt, answer, report, evidence };
}

/** Compare complete retained artifacts after the journal has reopened. */
function assertReplayEvidence(
  fixture: TestingRewindFixture,
  saved: ReturnType<typeof replayEvidence>,
) {
  const retained = fixture.task.observations<{
    edits?: typeof saved.receipt;
    clarification?: { question: string; answer: string };
    researchResult?: { evidence: string };
  }>();
  assert.deepEqual(retained.findLast((event) => event.edits)?.edits, saved.receipt);
  assert.deepEqual(retained.findLast((event) => event.clarification)?.clarification, {
    question: 'Which requirement?',
    answer: saved.answer,
  });
  assert.equal(
    retained.findLast((event) => event.researchResult)?.researchResult?.evidence,
    saved.evidence,
  );
  assert.equal(fixture.task.readFile(saved.evidence).text, saved.report);
}

/** Request each subsequent activity through the public steward boundary. */
async function assertReplayRequests(fixture: TestingRewindFixture) {
  for (const activity of ['testing', 'implementation'] as const) {
    fixture.activity = activity;
    const context = await fixture.context();
    assert.deepEqual(context.localRepair, {
      ...latestReplay,
      originatingFinding: originalReplay,
      targetCompleted: false,
    });
    assert.deepEqual(context.completedActivities, ['documentation']);
    assert.deepEqual(context.previouslyCompletedActivities, ['testing', 'implementation']);
    if (activity === 'testing') assert.equal(context.retainedTesting.redLog, fixture.red);
  }
}

test('nested findings and retained progress survive journal reopening and later requests', async (t) => {
  const fixture = new TestingRewindFixture(t);
  const saved = replayEvidence(fixture);
  fixture.task.record({
    position: { completed: 0, activities: { original: 1 } },
    repair: latestReplay,
  });
  const position = fixture.task.history().findLast((event) => 'position' in event);
  const checks = fixture.task.observations<{ check?: unknown }>().filter((event) => event.check);
  await fixture.restart();
  assert.deepEqual(
    fixture.task.history().findLast((event) => 'position' in event),
    position,
  );
  assert.deepEqual(
    fixture.task.observations<{ check?: unknown }>().filter((event) => event.check),
    checks,
  );
  assertReplayEvidence(fixture, saved);
  await assertReplayRequests(fixture);
  const plan = fixture.task.history().findLast((event) => 'plan' in event);
  assert(plan && 'plan' in plan);
  assert.deepEqual(plan.plan.milestones[0], rewindMilestone);
});

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
        assert.equal(JSON.stringify(data.assignment).split('Add missing regression').length - 1, 1);
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
