import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import { activities, type Plan, type PlanActivity } from '../../../direction/src/index.js';
import { Workflow, type TaskEvent, type WorkflowServices } from '../../src/index.js';

type Editable = Exclude<PlanActivity, 'review' | 'release'>;

/** Keep the public workflow fixture explicit while isolating inference and upstream effects. */
class LocalRepairScenario {
  readonly calls: string[] = [];
  readonly events: TaskEvent[] = [];
  readonly cancellation = new AbortController();
  private reviews = 0;
  private readonly plan: Plan = {
    focus: { purpose: 'Repair locally', objectives: ['Deliver'], constraints: ['Keep acceptance'] },
    milestones: [
      {
        id: 'work',
        owner: 'owner',
        criteria: [{ id: 'done', description: 'The work is correct' }],
        steps: activities.map((activity) => ({
          activity,
          checklist: [{ id: activity, criteria: ['done'], expected: 'Correct work' }],
        })),
      },
    ],
  };
  private readonly capture = {
    components: {
      owner: {
        id: 'owner',
        owns: [],
        activities: Object.fromEntries(
          activities.map((activity) => [activity, { profile: 'fixture' }]),
        ),
      },
    },
  } as unknown as Capture;

  /** Select the affected Step and an optional interruption at the durable rewind boundary. */
  constructor(
    private readonly target: Editable,
    private readonly interrupt = false,
    private readonly repeat = false,
  ) {}

  private readonly services: WorkflowServices = {
    execution: {
      admit: async () => ({
        capture: this.capture,
        goal: 'Repair locally',
        record: (event) => this.events.push(event),
        history: () => this.events,
        finish() {},
        close() {},
      }),
      checkpoint: async (_session, activation) => {
        this.events.push({ activation });
      },
      assemble: async () => ({ digest: 'candidate', evidence: [] }),
    },
    direction: {
      plan: async () => {
        this.calls.push('director');
        return { kind: 'plan', plan: this.plan };
      },
      revise: async () => assert.fail('An ordinary local finding must not invoke Direction'),
    },
    agent: {
      execute: async (_session, _milestone, activity) => {
        this.calls.push(activity);
        if (activity === 'review' && (++this.reviews === 1 || this.repeat))
          return {
            kind: 'repair',
            activity: this.target,
            reason: 'Correct the observed defect',
            input: 'same-input',
            evidence: ['finding'],
          };
        return { kind: 'completed', evidence: [] };
      },
    },
    verification: {
      assess: async () => ({
        kind: 'accepted',
        candidate: 'candidate',
        criteria: ['done'],
        evidence: [],
      }),
    },
    delivery: {
      integrate: async () => {
        this.calls.push('delivery');
        return { kind: 'merged', commit: 'staging', evidence: [] };
      },
    },
  };

  /** Drive the canonical public entry and optionally cancel after the atomic repair position. */
  run(signal = this.cancellation.signal) {
    return new Workflow(this.services).run(
      { directory: '.', goal: 'Repair locally' },
      {
        progress: (event) => {
          if (
            this.interrupt &&
            event.message.startsWith('Repair ') &&
            !this.cancellation.signal.aborted
          )
            this.cancellation.abort();
        },
      },
      signal,
    );
  }
}

for (const target of ['documentation', 'testing', 'implementation'] as const) {
  test(`WFL-7: self-review rewinds to ${target} within its milestone`, async () => {
    const scenario = new LocalRepairScenario(target);
    assert.equal((await scenario.run()).kind, 'merged');
    const affected = activities
      .slice(activities.indexOf(target))
      .filter((activity) => activity !== 'release');
    assert.deepEqual(scenario.calls, [
      'director',
      'documentation',
      'testing',
      'implementation',
      'review',
      ...affected,
      'delivery',
    ]);
    assert.equal(scenario.events.filter((event) => 'plan' in event).length, 1);
    assert(
      scenario.events.some((event) => 'position' in event && event.repair?.activity === target),
    );
  });
}

test('WFL-7: interruption after a rewind resumes the first affected activity without replanning', async () => {
  const scenario = new LocalRepairScenario('testing', true);
  assert.equal((await scenario.run()).kind, 'cancelled');
  assert.equal((await scenario.run(new AbortController().signal)).kind, 'merged');
  assert.deepEqual(scenario.calls, [
    'director',
    'documentation',
    'testing',
    'implementation',
    'review',
    'testing',
    'implementation',
    'review',
    'delivery',
  ]);
});

test('WFL-6: unchanged repeated self-review findings hold before a third activation', async () => {
  const scenario = new LocalRepairScenario('implementation', false, true);
  const result = await scenario.run();
  assert.equal(result.kind, 'blocked');
  assert.deepEqual(scenario.calls, [
    'director',
    'documentation',
    'testing',
    'implementation',
    'review',
    'implementation',
    'review',
  ]);
});
