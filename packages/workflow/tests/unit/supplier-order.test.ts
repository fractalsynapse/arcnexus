import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import {
  activities,
  type Milestone,
  type Plan,
  type PlanActivity,
} from '../../../direction/src/index.js';
import { Workflow, type ActivityOutcome, type WorkflowServices } from '../../src/index.js';

const activity = {
  role: 'steward',
  profile: 'profile',
  instructions: [],
  operations: [],
  standards: [],
};
const capture: Capture = {
  source: { root: '.', revision: 'base', remote: '', paths: [], read: () => '' },
  project: {
    id: 'fixture',
    remote: '',
    contractRegistry: '',
    planTemplate: '',
    director: { component: 'owner', activity: 'planning' },
    verifier: { component: 'owner', activity: 'assessment' },
  },
  components: {
    owner: {
      id: 'owner',
      purpose: 'Work',
      owns: [],
      activities: { implementation: activity, review: activity },
    },
    supplier: {
      id: 'supplier',
      purpose: 'Supply',
      owns: [],
      activities: { implementation: activity },
    },
  },
  contracts: [],
  roles: {},
  profiles: {},
  operations: {},
  standards: {},
};

type Scenario = 'late' | 'correction' | 'linked' | 'already-complete' | 'release-only';

/** Supply a milestone with the common five-step shape and selected executable work. */
function milestone(id: string, owner: string, ...steps: PlanActivity[]): Milestone {
  return {
    id,
    owner,
    criteria: [{ id, description: `Complete ${id}` }],
    steps: activities.map((step) => ({
      activity: step,
      ...(steps.includes(step)
        ? { checklist: [{ id: step, criteria: [id], expected: `Run ${step}` }] }
        : { checklist: [], inapplicable: 'Outside this scenario' }),
    })),
  };
}

/** Exercise real Workflow cursor and validation with deterministic responses at its boundaries. */
class SupplierTask implements WorkflowServices {
  readonly calls: string[] = [];
  private readonly accepted = milestone('accepted', 'owner', 'implementation');
  private readonly requester = milestone('requester', 'owner', 'implementation', 'review');
  private readonly supplier: Milestone;
  private readonly initial: Plan;

  /** Choose where Direction puts the correction or an already planned supplier. */
  constructor(private readonly scenario: Scenario) {
    const linked = scenario === 'linked';
    this.supplier = milestone(
      'required',
      linked ? 'supplier' : 'owner',
      scenario === 'release-only' ? 'release' : 'implementation',
    );
    this.initial = {
      focus: {
        purpose: 'Deliver changes',
        objectives: ['Review the work'],
        constraints: ['Keep accepted work'],
      },
      milestones: [this.accepted, this.requester, ...(linked ? [this.supplier] : [])],
    };
  }

  readonly execution: WorkflowServices['execution'] = {
    admit: async () => ({ capture, goal: 'Fix the fixture', record() {}, finish() {}, close() {} }),
    assemble: async () => ({ digest: 'candidate', evidence: [] }),
  };

  readonly direction: WorkflowServices['direction'] = {
    plan: async () => ({ kind: 'plan', plan: this.initial }),
    revise: async (_session, _plan, feedback) => {
      this.calls.push('direction:revise');
      assert.equal(feedback.kind, 'supplier');
      assert.equal(feedback.requester, this.requester.id);
      if (this.scenario === 'already-complete') return { kind: 'plan', plan: this.initial };
      const pending =
        this.scenario === 'late'
          ? [this.requester, this.supplier]
          : [this.supplier, this.requester];
      return { kind: 'plan', plan: { ...this.initial, milestones: [this.accepted, ...pending] } };
    },
  };

  readonly agent: WorkflowServices['agent'] = {
    execute: async (_session, selected, step) => this.execute(selected.id, step),
  };

  readonly verification: WorkflowServices['verification'] = {
    assess: async (_session, plan, candidate) => ({
      kind: 'accepted',
      candidate: candidate.digest,
      criteria: plan.milestones.flatMap(({ criteria }) => criteria.map(({ id }) => id)),
      evidence: [],
    }),
  };

  readonly delivery: WorkflowServices['delivery'] = {
    integrate: async () => ({ kind: 'merged', commit: 'staging-merge', evidence: [] }),
  };

  /** Run the public task entry point with an isolated observer. */
  run() {
    return new Workflow(this).run(
      { directory: '.', goal: 'Fix the fixture' },
      { progress() {} },
      new AbortController().signal,
    );
  }

  /** Request a correction during review and expose any premature reactivation. */
  private execute(id: string, step: PlanActivity): ActivityOutcome {
    this.calls.push(`${id}/${step}`);
    if (
      id !== this.requester.id ||
      step !== 'review' ||
      this.calls.includes('required/implementation')
    )
      return { kind: 'completed', evidence: [] };
    if (this.calls.includes('direction:revise')) {
      if (this.scenario === 'already-complete') return { kind: 'completed', evidence: [] };
      return { kind: 'blocked', reason: 'Review resumed without the correction', evidence: [] };
    }
    const target: Partial<Record<Scenario, string>> = {
      linked: this.supplier.id,
      'already-complete': this.accepted.id,
    };
    return {
      kind: 'supplier',
      milestone: target[this.scenario] ?? this.requester.id,
      owner: this.supplier.owner,
      reason: 'Review found work required from a steward',
      evidence: ['review:missing-correction'],
    };
  }
}

const beforeCorrection = [
  'accepted/implementation',
  'requester/implementation',
  'requester/review',
  'direction:revise',
];

for (const scenario of ['correction', 'linked'] as const) {
  test(`WFL-2: a ${scenario} supplier runs before the paused review resumes`, async () => {
    const task = new SupplierTask(scenario);
    assert.equal((await task.run()).kind, 'merged');
    assert.deepEqual(task.calls, [
      ...beforeCorrection,
      'required/implementation',
      'requester/review',
    ]);
  });
}

test('WFL-2: an explicitly linked completed supplier is reused without redoing work', async () => {
  const task = new SupplierTask('already-complete');
  assert.equal((await task.run()).kind, 'merged');
  assert.deepEqual(task.calls, [...beforeCorrection, 'requester/review']);
});

for (const scenario of ['late', 'release-only'] as const) {
  test(`WFL-2: a ${scenario} correction blocks before review is reactivated`, async () => {
    const task = new SupplierTask(scenario);
    const result = await task.run();
    assert.equal(result.kind, 'blocked');
    assert.match(result.reason, /runnable supplier work.*before requester/);
    assert.deepEqual(result.evidence, ['review:missing-correction']);
    assert.deepEqual(task.calls, beforeCorrection);
  });
}
