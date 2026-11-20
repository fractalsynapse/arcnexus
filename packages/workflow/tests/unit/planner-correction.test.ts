import assert from 'node:assert/strict';
import test from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import { activities, type Plan, type Rejection } from '../../../direction/src/index.js';
import { Workflow, type TaskSession, type WorkflowServices } from '../../src/index.js';

export const suite = { owner: 'workflow', level: 'unit', tags: ['regression'] } as const;

const criterion = {
  id: 'approved-bytes',
  description: 'Apply the reviewed objective and goal bytes',
};
const plan: Plan = {
  focus: {
    purpose: 'Improve a goal',
    objectives: ['Preserve intent'],
    constraints: ['Use approved bytes'],
  },
  milestones: [
    {
      id: 'records',
      owner: 'planner',
      criteria: [criterion],
      steps: activities.map((activity) =>
        activity === 'documentation'
          ? {
              activity,
              checklist: [
                { id: 'approved', criteria: [criterion.id], expected: 'Approved goal bytes' },
              ],
            }
          : { activity, checklist: [], inapplicable: 'Outside this fixture' },
      ),
    },
  ],
};
const findings: Rejection[] = [
  {
    owner: 'planner',
    criterion: criterion.id,
    reason: 'Missing exact measure',
    evidence: ['review-scope'],
  },
];

/** Exercise a correction on one task lane with a fresh approved candidate. */
class PlannerCorrectionScenario {
  readonly visits: string[] = [];
  private changed = 0;
  private readonly session = {
    capture: {
      components: {
        planner: { id: 'planner', activities: { documentation: { profile: 'fixture' } } },
      },
    } as unknown as Capture,
    goal: 'Improve a goal',
    record() {},
    finish() {},
    close() {},
  } satisfies TaskSession;
  private readonly services: WorkflowServices = {
    execution: {
      admit: async () => this.session,
      assemble: async () => ({ digest: `candidate-${this.changed}`, evidence: [] }),
    },
    planner: {
      propose: async (_session, _mode, _observer, _signal, feedback) => {
        this.visits.push(feedback ? 'correction' : 'proposal');
        if (feedback) assert.deepEqual(feedback, findings);
        return plan;
      },
      apply: async () => {
        this.visits.push('apply');
        ++this.changed;
        return { kind: 'completed', evidence: [] };
      },
    },
    direction: {
      plan: async () => assert.fail('Planner owns this proposal'),
      revise: async () => assert.fail('Planner owns this correction'),
    },
    agent: { execute: async () => assert.fail('Planner owns these approved edits') },
    verification: {
      assess: async (_session, _plan, candidate) => {
        this.visits.push(candidate.digest);
        return this.changed === 1
          ? { kind: 'rejected', candidate: candidate.digest, findings }
          : {
              kind: 'accepted',
              candidate: candidate.digest,
              criteria: [criterion.id],
              evidence: [],
            };
      },
    },
    delivery: { integrate: async () => ({ kind: 'merged', commit: 'staging', evidence: [] }) },
  };

  /** Drive one structured planning invocation through independent review and delivery. */
  run() {
    return new Workflow(this.services).run(
      { directory: '.', goal: this.session.goal, planning: 'objective' },
      { progress() {} },
      new AbortController().signal,
    );
  }
}

test('a rejected Planner candidate returns its findings and reviews the corrected candidate', async () => {
  const scenario = new PlannerCorrectionScenario();
  assert.equal((await scenario.run()).kind, 'merged');
  assert.deepEqual(scenario.visits, [
    'proposal',
    'apply',
    'candidate-1',
    'correction',
    'apply',
    'candidate-2',
  ]);
});
