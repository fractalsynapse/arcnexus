import assert from 'node:assert/strict';
import test from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import { PublicationCheckFailure } from '../../../delivery/src/index.js';
import { activities, type Milestone, type Plan } from '../../../direction/src/index.js';
import { Workflow, type TaskEvent, type WorkflowServices } from '../../src/index.js';

export const suite = { owner: 'workflow', level: 'unit', tags: ['regression'] } as const;

/** Give each accepted contribution its complete ordered activity shape. */
function milestone(id: string): Milestone {
  return {
    id,
    owner: 'work',
    criteria: [{ id: 'behavior', description: 'The real checks pass' }],
    steps: activities.map((activity) => ({
      activity,
      ...(activity === 'implementation'
        ? { checklist: [{ id, criteria: ['behavior'], expected: 'Repair the observed behavior' }] }
        : { checklist: [], inapplicable: 'Outside this fixture contribution' }),
    })),
  };
}

/** Exercise the real task loop with observable publication, audit and correction seams. */
class PublicationScenario implements WorkflowServices {
  readonly calls: string[] = [];
  readonly events: TaskEvent[] = [];
  private readonly original = milestone('original');
  private readonly plan: Plan = {
    focus: {
      purpose: 'Deliver the goal',
      objectives: ['Pass the captured behavior checks'],
      constraints: ['Preserve ownership and original acceptance'],
    },
    milestones: [this.original],
  };
  private corrected = false;
  private observed = false;

  /** Select first publication, resumed publication or a genuine external hold. */
  constructor(
    private readonly resumed = false,
    private readonly external = false,
  ) {
    if (resumed)
      this.events.push(
        { plan: this.plan },
        { position: { completed: 1, activities: { original: 3 } } },
      );
  }

  /** Bind a generic owner without granting another component's write scope. */
  private capture(): Capture {
    return {
      source: { root: '.', revision: 'base' },
      components: {
        work: {
          id: 'work',
          purpose: 'Own the repair',
          owns: [],
          activities: {
            implementation: {
              role: 'work',
              profile: 'profile',
              instructions: [],
              operations: [],
              standards: [],
            },
          },
        },
      },
    } as unknown as Capture;
  }

  /** Invoke the public lifecycle and retain its exact final outcome. */
  run() {
    return new Workflow(this).run(
      { directory: '.', goal: 'Deliver the goal' },
      { progress() {} },
      new AbortController().signal,
    );
  }

  readonly execution: WorkflowServices['execution'] = {
    admit: async () => ({
      capture: this.capture(),
      goal: 'Deliver the goal',
      record: (event) => this.events.push(event),
      history: () => this.events,
      finish() {},
      close() {},
    }),
    assemble: async () => ({
      digest: this.corrected ? 'corrected-tree' : 'original-tree',
      evidence: [],
    }),
  };

  readonly direction: WorkflowServices['direction'] = {
    plan: async () => ({ kind: 'plan', plan: this.plan }),
    revise: async (_session, _plan, feedback) => {
      this.calls.push('direction');
      assert.equal(feedback.kind, 'rejection', JSON.stringify(feedback));
      return {
        kind: 'plan',
        plan: { ...this.plan, milestones: [this.original, milestone('correction')] },
      };
    },
  };

  readonly agent: WorkflowServices['agent'] = {
    execute: async (_session, selected) => {
      this.calls.push(selected.id);
      this.corrected ||= selected.id === 'correction';
      return { kind: 'completed', evidence: [] };
    },
  };

  readonly verification: WorkflowServices['verification'] = {
    assess: async (_session, _plan, candidate) => this.assess(candidate.digest),
  };

  readonly delivery: WorkflowServices['delivery'] = {
    resume: async () => this.resume(),
    integrate: async () => this.publish(),
  };

  /** Expose a previously failed PR without inventing a successful publication. */
  private resume(): undefined {
    if (!this.resumed) return;
    this.calls.push('resume');
    this.fail();
  }

  /** Return new engineering evidence through the independent verdict boundary. */
  private async assess(candidate: string) {
    this.calls.push('review:' + candidate);
    if (this.observed && !this.corrected && !this.external)
      return {
        kind: 'rejected' as const,
        candidate,
        findings: [
          {
            owner: 'work',
            criterion: 'behavior',
            reason: 'Actual hosted assertion failed',
            evidence: ['complete-ci.log'],
          },
        ],
      };
    return {
      kind: 'accepted' as const,
      candidate,
      criteria: ['behavior'],
      evidence: ['complete-ci.log'],
    };
  }

  /** Keep one publication identity and expose only the corrected merge. */
  private async publish() {
    this.calls.push('publish');
    if (!this.corrected) this.fail();
    return { kind: 'merged' as const, commit: 'staging', evidence: ['same-pr'] };
  }

  /** Model the typed actual failure after Delivery retained its complete diagnostics. */
  private fail(): never {
    this.observed = true;
    throw new PublicationCheckFailure('Required check failed on the same PR', 'original-tree', [
      'complete-ci.log',
    ]);
  }
}

test('hosted check failure returns through independent rejection and accountable correction', async () => {
  const scenario = new PublicationScenario();
  const outcome = await scenario.run();
  assert.equal(outcome.kind, 'merged', JSON.stringify(outcome));
  assert.deepEqual(scenario.calls, [
    'original',
    'review:original-tree',
    'publish',
    'review:original-tree',
    'direction',
    'correction',
    'review:corrected-tree',
    'publish',
  ]);
});

test('resumed failed publication returns to ordinary preparation and correction', async () => {
  const scenario = new PublicationScenario(true);
  const outcome = await scenario.run();
  assert.equal(outcome.kind, 'merged', JSON.stringify(outcome));
  assert.equal(scenario.calls[0], 'resume');
  assert.ok(scenario.calls.includes('correction'));
  assert.ok(!scenario.calls.includes('original'));
});

test('an accepted candidate with the same failed external gate holds without a publication loop', async () => {
  const scenario = new PublicationScenario(false, true);
  const outcome = await scenario.run();
  assert.equal(outcome.kind, 'blocked');
  assert.deepEqual(outcome.evidence, ['complete-ci.log']);
  assert.equal(scenario.calls.filter((call) => call === 'publish').length, 1);
  assert.ok(!scenario.calls.includes('direction'));
});
