import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blockedCorrection } from '../../src/blocked-correction.js';
import type { Capture } from '../../../architecture/src/index.js';
import {
  activities,
  type Milestone,
  type Plan,
  type PlanActivity,
} from '../../../direction/src/index.js';
import {
  Workflow,
  type ActivityOutcome,
  type ActivityCheckpoint,
  type TaskEvent,
  type WorkflowServices,
} from '../../src/index.js';

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
function milestone(
  id: string,
  owner: string,
  steps: readonly PlanActivity[],
  criterion = id,
): Milestone {
  return {
    id,
    owner,
    criteria: [{ id: criterion, description: `Complete ${criterion}` }],
    steps: activities.map((step) => ({
      activity: step,
      ...(steps.includes(step)
        ? { checklist: [{ id: step, criteria: [criterion], expected: `Run ${step}` }] }
        : { checklist: [], inapplicable: 'Outside this scenario' }),
    })),
  };
}

/** Exercise real Workflow cursor and validation with deterministic responses at its boundaries. */
class SupplierTask implements WorkflowServices {
  readonly calls: string[] = [];
  private readonly accepted = milestone('accepted', 'owner', ['implementation']);
  private readonly requester = milestone('requester', 'owner', ['implementation', 'review']);
  private readonly supplier: Milestone;
  private readonly initial: Plan;

  /** Choose where Direction puts the correction or an already planned supplier. */
  constructor(private readonly scenario: Scenario) {
    const linked = scenario === 'linked';
    this.supplier = milestone(
      'required',
      linked ? 'supplier' : 'owner',
      scenario === 'release-only' ? ['release'] : ['implementation'],
      scenario === 'release-only' ? this.requester.id : 'required',
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

/** Keep the tree fixed and vary only the host's verified evidence presented to review. */
class EvidenceReviewTask extends SupplierTask {
  private readonly original = milestone('original', 'owner', ['implementation'], 'readiness');
  private readonly correction = milestone('evidence', 'owner', ['implementation'], 'readiness');
  readonly plan: Plan = {
    focus: {
      purpose: 'Verify the fixture',
      objectives: ['Fix evidence'],
      constraints: ['Preserve source'],
    },
    milestones: [this.original],
  };
  reviewed = 0;

  /** Select whether the correction can actually supply different evidence. */
  constructor(private readonly changed: boolean) {
    super('correction');
  }

  override readonly execution: WorkflowServices['execution'] = {
    admit: async () => ({ capture, goal: 'Fix evidence', record() {}, finish() {}, close() {} }),
    assemble: async () => ({
      digest: 'unchanged-tree',
      evidence: [],
      ownerEvidenceDigest: this.changed && this.reviewed ? 'complete' : 'incomplete',
    }),
  };

  override readonly direction: WorkflowServices['direction'] = {
    plan: async () => ({ kind: 'plan', plan: this.plan }),
    revise: async () => ({
      kind: 'plan',
      plan: { ...this.plan, milestones: [this.original, this.correction] },
    }),
  };

  override readonly verification: WorkflowServices['verification'] = {
    assess: async (_session, _plan, candidate) => {
      this.reviewed++;
      if (this.reviewed === 1)
        return {
          kind: 'rejected',
          candidate: candidate.digest,
          findings: [
            {
              owner: 'owner',
              criterion: 'readiness',
              evidence: ['record'],
              reason: 'Missing owner exit record',
            },
          ],
        };
      return {
        kind: 'accepted',
        candidate: candidate.digest,
        criteria: ['readiness'],
        evidence: ['record'],
      };
    },
  };
}

test('WFL-2: a rejected tree is reviewed again with genuinely changed host evidence', async () => {
  const task = new EvidenceReviewTask(true);
  assert.equal((await task.run()).kind, 'merged');
  assert.equal(task.reviewed, 2);
});

test('WFL-2: unchanged host evidence does not reopen a rejected tree', async () => {
  const task = new EvidenceReviewTask(false);
  assert.equal((await task.run()).kind, 'failed');
  assert.equal(task.reviewed, 1);
});

/** Use the real review and supplier seams for one stalled correction. */
class BlockedCorrectionTask extends EvidenceReviewTask {
  private readonly stalled = milestone('stalled', 'owner', ['implementation'], 'readiness');
  private readonly smaller = milestone('smaller', 'owner', ['implementation'], 'readiness');
  private readonly events: TaskEvent[] = [];
  private narrowed = false;

  /** Keep a repeated stall observable without opening another supplier sequence. */
  constructor(private readonly repeated: boolean) {
    super(true);
  }

  override readonly execution: WorkflowServices['execution'] = {
    admit: async () => ({
      capture,
      goal: 'Fix evidence',
      history: () => this.events,
      record: (event) => this.events.push(event),
      finish() {},
      close() {},
    }),
    assemble: async () => ({ digest: this.narrowed ? 'fixed' : 'rejected', evidence: [] }),
    checkpoint: async (_session, activation) => {
      this.events.push({ activation });
    },
  };

  override readonly direction: WorkflowServices['direction'] = {
    plan: async () => ({ kind: 'plan', plan: this.plan }),
    revise: async (_session, _plan, feedback) => {
      const initial = this.plan.milestones;
      if (feedback.kind === 'rejection')
        return { kind: 'plan', plan: { ...this.plan, milestones: [...initial, this.stalled] } };
      assert.equal(feedback.kind, 'supplier');
      assert.equal(feedback.owner, 'owner');
      assert.match(feedback.reason, /Fixture needs a smaller case/);
      assert.deepEqual(feedback.evidence, ['blocked.log']);
      return {
        kind: 'plan',
        plan: { ...this.plan, milestones: [...initial, this.smaller, this.stalled] },
      };
    },
  };

  override readonly agent: WorkflowServices['agent'] = {
    execute: async (_session, { id }) => {
      this.calls.push(id);
      if (id === this.smaller.id) this.narrowed = true;
      if (id === this.stalled.id && (!this.narrowed || this.repeated))
        return {
          kind: 'blocked',
          reason: 'Fixture needs a smaller case',
          evidence: ['blocked.log'],
        };
      return { kind: 'completed', evidence: [] };
    },
  };
}

test('a blocked reviewer correction runs a smaller same-owner contribution before resuming', async () => {
  const task = new BlockedCorrectionTask(false);
  assert.equal((await task.run()).kind, 'merged');
  assert.deepEqual(task.calls, ['original', 'stalled', 'smaller', 'stalled']);
});

test('a repeated stall holds the original diagnostic after its smaller contribution', async () => {
  const task = new BlockedCorrectionTask(true);
  const result = await task.run();
  assert.equal(result.kind, 'blocked');
  assert.equal(result.reason, 'Fixture needs a smaller case');
  assert.deepEqual(task.calls, ['original', 'stalled', 'smaller', 'stalled']);
});

/** Exercise fresh diagnostics and repeated host failures after earlier review correction. */
class ReviewDiagnosticScenario {
  private readonly correction = milestone('correction', 'owner', ['implementation'], 'readiness');
  private readonly held: ActivityCheckpoint = {
    milestone: this.correction.id,
    owner: 'owner',
    index: 2,
    step: 'implementation',
    outcome: { kind: 'blocked', reason: 'A distinct assertion fails', evidence: ['new.log'] },
  };

  private readonly rejection: TaskEvent = {
    candidate: { digest: 'candidate', evidence: [] },
    verdict: {
      kind: 'rejected',
      candidate: 'candidate',
      findings: [
        { owner: 'owner', criterion: 'readiness', reason: 'Parity missing', evidence: [] },
      ],
    },
  };

  /** Keep a rejected criterion and one previously attempted supplier in the journal. */
  private history(): TaskEvent[] {
    const request = {
      kind: 'supplier' as const,
      milestone: this.correction.id,
      requester: this.correction.id,
      owner: 'owner',
      reason: 'Compiler error',
      evidence: ['old.log'],
    };
    const previous = { ...this.held, outcome: { ...request, kind: 'blocked' as const } };
    return [
      this.rejection,
      { activation: previous },
      {
        plan: {
          focus: { purpose: 'Repair', objectives: [], constraints: [] },
          milestones: [this.correction],
        },
        supplier: { milestone: 'smaller', request },
      },
      { activation: this.held },
    ];
  }

  /** Return a fresh review failure to Direction and keep a repeated host check held. */
  run() {
    const next = blockedCorrection(this.history(), this.correction, this.held);
    assert(next);
    assert.match(next.reason, /A distinct assertion fails/);
    assert.deepEqual(next.evidence, ['new.log']);
    assert(this.held.outcome.kind === 'blocked');
    const repeated = {
      ...this.held,
      outcome: {
        ...this.held.outcome,
        failedCheck: {
          id: 'owner-tests',
          activity: 'implementation' as const,
          expected: 'pass' as const,
          status: 1,
          log: 'new.log',
        },
      },
    };
    assert.equal(blockedCorrection(this.history(), this.correction, repeated), undefined);
  }
}

test('a new review diagnostic is recoverable and a repeated host check remains held', () =>
  new ReviewDiagnosticScenario().run());
