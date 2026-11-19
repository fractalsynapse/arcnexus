import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import { activities, type Milestone, type Plan } from '../../../direction/src/index.js';
import { Workflow, type TaskEvent, type WorkflowServices } from '../../src/index.js';

/** Create a distinguishable accepted milestone with an executable implementation step. */
function milestone(id: string): Milestone {
  return {
    id,
    owner: 'owner',
    criteria: [{ id, description: `Original acceptance for ${id}` }],
    steps: activities.map((activity) =>
      activity === 'implementation'
        ? { activity, checklist: [{ id: activity, criteria: [id], expected: 'Complete work' }] }
        : { activity, checklist: [], inapplicable: 'Not needed' },
    ),
  };
}

/** Exercise revision through the public workflow boundary with retained task observations. */
class RevisionScenario {
  readonly completed = Array.from({ length: 120 }, (_, index) => milestone(`completed-${index}`));
  readonly requester = milestone('requester');
  readonly plan: Plan = {
    focus: { purpose: 'Deliver', objectives: ['Complete work'], constraints: ['Keep acceptance'] },
    milestones: [...this.completed, this.requester],
  };
  readonly events: TaskEvent[] = [
    { plan: this.plan },
    { position: { completed: 120, activities: { requester: 2 } } },
    {
      feedback: {
        kind: 'answer',
        question: 'Prior question',
        answer: 'Complete retained answer',
        evidence: ['answer-artifact'],
      },
    },
    {
      activation: {
        milestone: 'requester',
        owner: 'owner',
        index: 1,
        step: 'testing',
        outcome: {
          kind: 'blocked',
          reason: 'Retained failed attempt',
          evidence: ['failed-attempt'],
        },
      },
    },
  ];
  readonly calls: unknown[] = [];
  readonly artifacts = new Map<string, string>();
  private rejected = false;

  /** Choose an explicit supplier request or independent rejection after completed work. */
  constructor(private readonly path: 'supplier' | 'rejection') {}

  readonly services: WorkflowServices = {
    execution: {
      admit: async () => ({
        capture: {
          components: {
            owner: { id: 'owner', owns: [], activities: { implementation: { profile: 'p' } } },
          },
        } as unknown as Capture,
        goal: 'Deliver',
        record: (event) => this.events.push(event),
        history: () => this.events,
        observations: () => structuredClone(this.events),
        store: (name: string, contents: string) => {
          const reference = `artifact:${name}:${this.artifacts.size}`;
          this.artifacts.set(reference, contents);
          return reference;
        },
        finish() {},
        close() {},
      }),
      assemble: async () => ({ digest: 'candidate', evidence: [] }),
    },
    direction: {
      plan: async () => assert.fail('An accepted plan must not be planned again'),
      revise: async (_session, context, finding) => {
        this.calls.push({ context, finding });
        return { kind: 'question', question: 'Pause after observing revision input', evidence: [] };
      },
    },
    agent: {
      execute: async () =>
        this.path === 'supplier'
          ? {
              kind: 'supplier',
              owner: 'owner',
              milestone: 'requester',
              reason: 'Need help',
              evidence: ['supplier-finding'],
            }
          : { kind: 'completed', evidence: ['completed-answer'] },
    },
    verification: {
      assess: async (_session, _plan, candidate) => {
        this.rejected = true;
        return {
          kind: 'rejected',
          candidate: candidate.digest,
          findings: [
            {
              owner: 'owner',
              criterion: 'requester',
              reason: 'Needs correction',
              evidence: ['review-finding'],
            },
          ],
        };
      },
    },
    delivery: { integrate: async () => assert.fail('A rejected candidate cannot be delivered') },
  };

  /** Drive the shared lifecycle until the Director asks for a clarification. */
  async run() {
    const outcome = await new Workflow(this.services).run(
      { directory: '.', goal: 'Deliver' },
      { progress() {} },
      new AbortController().signal,
    );
    assert.equal(outcome.kind, 'blocked');
    assert.equal(this.rejected, this.path === 'rejection');
    return this.calls[0] as { context: unknown; finding: { kind: string } };
  }
}

for (const path of ['supplier', 'rejection'] as const) {
  test(`WFL-11/12: ${path} revision does not resend a large completed plan inline`, async () => {
    const scenario = new RevisionScenario(path);
    const call = await scenario.run();
    assert.equal(call.finding.kind, path);
    assert(!JSON.stringify(call.context).includes('completed-119'));
    assert.deepEqual(
      scenario.events.find((event) => 'plan' in event),
      { plan: scenario.plan },
    );
  });
}
