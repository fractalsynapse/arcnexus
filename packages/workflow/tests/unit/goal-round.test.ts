import assert from 'node:assert/strict';
import test from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import { activities, type StandingGoalEvidence } from '../../../direction/src/index.js';
import {
  Workflow,
  type StandingGoal,
  type TaskEvent,
  type TaskInput,
  type TaskSession,
  type WorkflowServices,
} from '../../src/index.js';

const ids = ['checkpoint', 'ownership', 'inspect', 'tests', 'delivery'];
const goals: StandingGoal[] = ids.map((id, index) => ({
  id,
  priority: index + 1,
  owner: id,
  body: `# ${id}\nMeasure the current staging revision.\n`,
}));
const signal = new AbortController().signal;
const criterion = {
  id: 'coverage',
  description: 'Cover the requirement missing from the green suite',
};
const gapPlan = {
  focus: {
    purpose: 'Cover a requirement',
    objectives: ['Add the regression'],
    constraints: ['Stay in scope'],
  },
  milestones: [
    {
      id: 'coverage-gap',
      owner: 'checkpoint',
      criteria: [criterion],
      steps: activities.map((activity) => ({
        activity,
        ...(activity === 'testing'
          ? {
              checklist: [
                {
                  id: 'regression',
                  criteria: [criterion.id],
                  expected: 'Exercise the missing case',
                },
              ],
            }
          : { checklist: [], inapplicable: 'Outside the fixture' }),
      })),
    },
  ],
};

/** Exercise Direction's decision after each measured standing goal. */
class RoundScenario {
  readonly admissions: TaskInput[] = [];
  readonly completed: number[] = [];
  readonly assessments: string[] = [];
  readonly activations: string[] = [];
  readonly repairs: string[] = [];
  private round = 1;

  /** Supply a host check result and choose whether green evidence hides a gap. */
  constructor(
    private readonly status: StandingGoalEvidence['status'] = 0,
    private readonly greenGap = false,
  ) {}

  private readonly services: WorkflowServices = {
    execution: {
      round: () => ({ id: this.round, goals, finish: () => this.complete() }),
      admit: async (input) => this.admit(input),
      measureGoal: async (_session, owner) => ({
        owner,
        revision: 'current-staging',
        status: this.status,
        log: `${owner}-tests.log`,
        recentChanges: ['a previous goal merged on staging'],
      }),
      assemble: async () => ({ digest: 'verified-candidate', evidence: [] }),
    },
    direction: {
      plan: async (session, _signal, measured) => this.assess(session, measured),
      revise: async (_session, _plan, feedback, _signal, measured) => {
        assert(feedback.kind === 'plan-repair');
        this.repairs.push(feedback.diagnostic);
        return this.noWork(measured);
      },
    },
    agent: {
      execute: async (_session, milestone) => {
        this.activations.push(milestone.id);
        return { kind: 'completed', evidence: [] };
      },
    },
    verification: {
      assess: async () => ({
        kind: 'accepted',
        candidate: 'verified-candidate',
        criteria: [criterion.id],
        evidence: [],
      }),
    },
    delivery: {
      integrate: async () => ({ kind: 'merged', commit: 'staging-merge', evidence: [] }),
    },
  };

  /** Retry the logical task with the durable assessment from its original attempt. */
  replay(history: readonly TaskEvent[]) {
    const input = { directory: '.', goal: goals[0]!.body, measureOwner: 'checkpoint' };
    const services: WorkflowServices = {
      ...this.services,
      execution: {
        ...this.services.execution,
        admit: async () => ({ ...this.admit(input), history: () => history }),
      },
    };
    return new Workflow(services).run(input, { progress() {} }, signal);
  }

  /** Evaluate one complete goal round through the public Workflow entry point. */
  run() {
    return new Workflow(this.services).round('.', { progress() {} }, signal);
  }

  /** Open engineering work on a green measure only when a concrete gap was observed. */
  private assess(session: TaskSession, measured?: StandingGoalEvidence) {
    assert(measured);
    assert.equal(measured.status, this.status);
    assert.equal(measured.revision, 'current-staging');
    assert.deepEqual(measured.recentChanges, ['a previous goal merged on staging']);
    assert.equal(session.goal, goals.find((goal) => goal.owner === measured.owner)?.body);
    this.assessments.push(measured.owner);
    if (this.greenGap && measured.owner === 'checkpoint') return { kind: 'plan', plan: gapPlan };
    return this.noWork(measured);
  }

  /** Cite the exact measured evidence when the Director reports no work. */
  private noWork(measured?: StandingGoalEvidence) {
    assert(measured);
    return {
      kind: 'satisfied',
      summary: 'The requirements and measure hold',
      evidence: [measured.log],
    };
  }

  /** Finish the observed round before allocating the next identity. */
  private complete() {
    this.completed.push(this.round++);
  }

  /** Record each admission and return a fixture with an accountable steward. */
  private admit(input: TaskInput): TaskSession {
    this.admissions.push(input);
    const capture = {
      components: {
        checkpoint: { id: 'checkpoint', owns: [], activities: { testing: { profile: 'profile' } } },
      },
    } as unknown as Capture;
    return { capture, goal: input.goal, record() {}, finish() {}, close() {} };
  }
}

test('the Director assesses all five goals afresh in priority order on each of three rounds', async () => {
  const fixture = new RoundScenario();
  for (const round of [1, 2, 3]) {
    const outcome = await fixture.run();
    assert(outcome.completed);
    assert.equal(outcome.round, round);
    assert.deepEqual(
      outcome.goals.map(({ id }) => id),
      ids,
    );
    assert(
      outcome.goals.every(({ outcome: result }) => result.kind === 'satisfied' && result.summary),
    );
  }
  assert.deepEqual(fixture.completed, [1, 2, 3]);
  assert.deepEqual(fixture.assessments, [...ids, ...ids, ...ids]);
  assert.deepEqual(fixture.activations, []);
  assert.equal(new Set(fixture.admissions.map(({ scope }) => scope)).size, 15);
});

test('a green suite can lead to engineering work when the Director sees a coverage gap', async () => {
  const fixture = new RoundScenario(0, true);
  const round = await fixture.run();
  assert(round.completed);
  assert.equal(round.goals[0]?.outcome.kind, 'merged');
  assert.deepEqual(fixture.activations, ['coverage-gap']);
  assert.deepEqual(fixture.assessments, ids);
});

test('failed and unavailable measures go to Direction but cannot be declared satisfied', async () => {
  for (const status of [1, 'not-applicable', null] as const) {
    const fixture = new RoundScenario(status);
    const round = await fixture.run();
    assert(!round.completed);
    assert.equal(round.goals[0]?.outcome.kind, 'failed');
    assert.deepEqual(fixture.assessments, ['checkpoint']);
    assert.deepEqual(fixture.repairs, [
      `Cannot satisfy a standing goal with owner check status ${status}`,
    ]);
    assert.deepEqual(fixture.activations, []);
  }
});

test('an interrupted round reuses a recorded Director assessment for its completed goal', async () => {
  const fixture = new RoundScenario();
  const assessment = {
    kind: 'satisfied' as const,
    commit: 'current-staging',
    summary: 'The Director inspected the captured revision.',
    evidence: ['checkpoint-tests.log'],
  };
  assert.deepEqual(await fixture.replay([{ assessment }]), assessment);
  assert.deepEqual(fixture.assessments, []);
});
