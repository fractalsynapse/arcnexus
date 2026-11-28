import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Architecture } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { activities, type Plan } from '../../../direction/src/index.js';
import {
  Workflow,
  type TaskInput,
  type TaskSession,
  type WorkflowServices,
} from '../../../workflow/src/index.js';
import type { Candidate, Verdict } from '../../../verification/src/index.js';
import { Execution } from '../../src/index.js';
import { AdoptionFixture } from '../fixtures/architecture-adoption.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

/** Verify the actual outer Workflow and normal task lifecycle against real approved bytes and journals. */
class ArchitectureDeliveryScenario {
  readonly fixture;
  readonly workflow;
  readonly calls: string[] = [];
  private admitted = 0;

  /** Substitute agent and delivery ports only; preserve real guide application, Git and Coordination. */
  constructor(t: TestContext) {
    this.fixture = new AdoptionFixture(t);
    this.fixture.controlAvailability(t);
    t.mock.method(this.fixture.task, 'cleanup', () => {});
    t.mock.method(this.fixture.parent, 'close', () => {});
    this.workflow = new Workflow(this.services());
  }

  /** Run the same transport-neutral Architecture operation used by the CLI. */
  async run() {
    return this.workflow.update(
      this.fixture.workspace,
      undefined,
      { progress: () => {} },
      new AbortController().signal,
    );
  }

  /** Keep ordinary prerequisite activities before exact host writes and independent candidate review. */
  private services(): WorkflowServices {
    const { parent, proposal } = this.fixture;
    const storage = parent.config.storage;
    const native = new Execution(new Architecture(), new Coordination(storage), storage);
    return {
      architecture: {
        propose: async () => {
          await this.fixture.approve();
          return { kind: 'approved', proposal, report: parent.evidence[0]! };
        },
      },
      execution: {
        admit: async (input, _signal, ancestor) => this.admit(input, ancestor),
        prepare: (session, issue, signal) => native.prepare(session, issue, signal),
        checkpoint: (session, activity, signal) => native.checkpoint(session, activity, signal),
        applyGuide: (session, id, signal) => native.applyGuide(session, id, signal),
        assemble: (session, signal) => native.assemble(session, signal),
      },
      direction: {
        track: async () => '10',
        plan: async () => ({ kind: 'plan', plan: this.plan() }),
        revise: async () => {
          throw new Error('Unexpected replanning');
        },
      },
      agent: { execute: async () => this.activity() },
      verification: { assess: async (_session, _plan, candidate) => this.review(candidate) },
      delivery: { integrate: async () => this.integrate() },
    };
  }

  /** Require each nested task to retain the real foreground parent rather than compete for admission. */
  private admit(input: TaskInput, ancestor?: TaskSession) {
    this.admitted++;
    if (this.admitted === 1) {
      assert.equal(input.architecture, true);
      return this.fixture.parent;
    }
    assert.equal(ancestor, this.fixture.parent);
    assert.equal(input.guide, this.fixture.proposal.id);
    return this.fixture.task;
  }

  /** Supply an explicit actor-authored fixture plan through the ordinary Direction port. */
  private plan(): Plan {
    this.calls.push('director');
    return {
      focus: {
        purpose: 'Assess the approved amendment',
        objectives: ['Check applicability'],
        constraints: ['Host-only exact guide writes'],
      },
      milestones: [
        {
          id: 'prerequisite',
          owner: 'service',
          criteria: [
            {
              id: 'approved-outcome',
              description: 'The proposal applies to the original service requirement',
            },
          ],
          steps: this.steps(),
        },
      ],
    };
  }

  /** Keep the explicit five-Step fixture plan canonical while activating only its read-only review. */
  private steps(): Plan['milestones'][number]['steps'] {
    return activities.map((activity) =>
      activity === 'review'
        ? {
            activity,
            checklist: [
              {
                id: 'review-guide',
                criteria: ['approved-outcome'],
                expected: 'Check proposal applicability',
              },
            ],
          }
        : { activity, checklist: [], inapplicable: 'Read-only proposal applicability scenario' },
    );
  }

  /** Inspect actual candidate contents at the independent-review boundary. */
  private review(candidate: Candidate): Verdict {
    this.calls.push('independent-review');
    assert(this.fixture.task.capture.operations['service-check']);
    return {
      kind: 'accepted',
      candidate: candidate.digest,
      criteria: ['approved-outcome'],
      evidence: this.fixture.task.evidence,
    };
  }

  /** Record external delivery separately from the local host-write and candidate assertions. */
  private integrate() {
    this.calls.push('delivery');
    return {
      kind: 'merged' as const,
      commit: 'fixture-staging-commit',
      evidence: this.fixture.task.evidence,
    };
  }

  /** Require the next steward to consume adopted authority while keeping the engineering base intact. */
  private activity() {
    this.calls.push('steward');
    assert(this.fixture.task.capture.operations['service-check']);
    assert.equal(this.fixture.task.config.capture, this.fixture.parent.config.capture);
    return { kind: 'completed' as const, evidence: [] };
  }
}

test('Architect delivers exact approved guides through the normal Director, steward and independent review sequence', async (t) => {
  const scenario = new ArchitectureDeliveryScenario(t);
  const outcome = await scenario.run();
  assert.equal(outcome.kind, 'merged', JSON.stringify(outcome));
  assert.deepEqual(scenario.calls, ['director', 'steward', 'independent-review', 'delivery']);
});
