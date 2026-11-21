import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { ActivitySelection, TaskContext } from '../../../architecture/src/index.js';
import { Agent } from '../../../agent/src/index.js';
import { supplierLinkDiagnostic } from '../../../direction/src/index.js';
import { Clarifications, steward, type HostTask, type HoldContext } from '../../src/index.js';
import { callerRevision, inboxIdentity, type ResearchResult } from '../../src/research.js';
import type { Clarification } from '../../src/clarifications.js';
import {
  answer,
  continuationAnswer,
  criterion,
  PreparedRecoveryFixture,
  recoveryPlan,
} from '../fixtures/prepared-recovery.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['recovery'] } as const;

const selection = { component: 'work', activity: 'implementation' };
const signal = new AbortController().signal;
const milestone = recoveryPlan().milestones[0]!;
const data = { milestone: { id: milestone.id }, acceptance: milestone.criteria };
const pendingQuestion = 'Which approved boundary permits the remaining change?';
const pendingAnswer = '  Approved boundary A.\n\nKeep the unresolved follow-up separate.  \n';
const reports = [
  'Original research A\n\nPreserve café, original authority and trailing spaces.  \n',
  'Recovered research B\n\nUse current ownership; retain the original requirement.\n',
];

/**
 * Real Git/SQLite admission and executable-provider MCP establish the caller.
 * The public steward consumes retained knowledge after recovery. Explicit research
 * and legacy supplier observations model their journal schemas, not live research.
 * Exact arrays and source bytes reject dropped, swapped, duplicated or transient
 * knowledge. Host approvals and independent review retain separate bindings.
 */
class CallerRecoveryScenario {
  readonly fixture: PreparedRecoveryFixture;
  readonly held: HoldContext[] = [];
  readonly repairs: Array<string | undefined> = [];
  readonly scopes: Array<{ actual: string; public: string }> = [];
  readonly research: ResearchResult[] = [];
  readonly gates: Clarification[] = [];
  readonly supplier;
  private readonly diagnostic: string;

  /** Seed independent rejection before the accepted corrective plan is recorded. */
  constructor(private readonly context: TestContext) {
    this.fixture = new PreparedRecoveryFixture(context);
    this.supplier = {
      kind: 'supplier' as const,
      owner: 'reviewer',
      milestone: milestone.id,
      reason: 'Retained legacy handoff must return to its actual caller.',
      question: 'Keep the original supplier diagnostic.\nDo not silently replan.',
      requester: milestone.id,
    };
    this.diagnostic = supplierLinkDiagnostic(recoveryPlan(), this.supplier)!;
    assert(this.diagnostic, 'The explicit legacy handoff must be invalid');
    this.fixture.answerQuestion = (question) =>
      question.startsWith(pendingQuestion) ? pendingAnswer : undefined;
    this.fixture.beforePlan = (task) => this.recordRejection(task);
    this.fixture.afterActivation = (task) => this.observeConsumers(task);
  }

  /** Exercise the supplied before/after public regression through actual MCP questions. */
  async run() {
    assert.equal((await this.fixture.run()).kind, 'failed');
    this.fixture.advance();
    this.fixture.recoveryContinuation = 'question';
    assert.equal((await this.fixture.run()).kind, 'merged');
    assert.equal(this.held.length, 2, 'Both public steward consumers must execute');
  }

  /** Preserve exact originating independent findings rather than inventing a blocked model response. */
  private recordRejection(task: HostTask) {
    if (this.fixture.tasks.length !== 1) return;
    const plan = recoveryPlan();
    task.record({ plan: { ...plan, milestones: [] } });
    const evidence = task.store('independent-caller-finding.md', 'Caller knowledge disappears.\n');
    task.record({
      feedback: {
        kind: 'rejection',
        findings: [
          {
            owner: 'work',
            criterion: criterion.id,
            reason: 'Caller continuity',
            evidence: [evidence],
          },
        ],
      },
    });
  }

  /** Capture actual caller identity and run its hold and supplier consumers before workspace cleanup. */
  private async observeConsumers(task: HostTask) {
    const actual = task
      .observations<{ clarification?: Clarification }>()
      .findLast(({ clarification }) => clarification?.answer !== undefined)!.clarification!;
    this.scopes.push({ actual: actual.scope, public: task.inboxScope(selection, data) });
    this.recordResearch(task, actual.scope);
    if (this.held.length === 0) this.recordSupplier(task);
    const pending = await this.openGate(task);
    const invocation = this.context.mock.method(
      task,
      'activate',
      async (_agent: Agent, _selection: ActivitySelection, input: TaskContext) => {
        this.repairs.push((input.assignment as { responseRepair?: string }).responseRepair);
        throw pending;
      },
    );
    const outcome = await steward(
      new Agent(this.fixture.architecture),
      task,
      milestone,
      'implementation',
      signal,
    );
    invocation.mock.restore();
    assert('holdContext' in outcome && outcome.holdContext, JSON.stringify(outcome));
    this.held.push(outcome.holdContext as HoldContext);
  }

  /** Record distinguishable complete reports once under the actual MCP conversation. */
  private recordResearch(task: HostTask, inbox: string) {
    const index = this.research.length;
    const evidence = task.store('caller-research.md', reports[index]!);
    const result: ResearchResult = {
      request: {
        id: 'report-' + index,
        inbox,
        requestedBy: selection,
        question: 'Research ' + index,
        decision: 'Preserve caller knowledge',
      },
      component: 'work',
      evidence,
      summary: 'Distinct report ' + index,
    };
    this.research.push(result);
    task.note({ researchResult: result });
  }

  /** Model a legacy acknowledged invalid supplier request using the actual prepared assignment shape. */
  private recordSupplier(task: HostTask) {
    const assignment = {
      ...data,
      milestone: {
        id: milestone.id,
        step: milestone.steps.find((step) => step.activity === 'implementation'),
      },
    };
    const scope = inboxIdentity(task, selection, assignment, callerRevision(task, selection));
    task.note({ projectRequest: { ...this.supplier, scope } });
  }

  /** Open a real unanswered gate, retaining its exact source evidence for hold reconstruction. */
  private async openGate(task: HostTask) {
    const ask = task.ask;
    task.ask = async () => undefined;
    const question = pendingQuestion + ' attempt ' + this.held.length;
    const clarifications = new Clarifications(
      task,
      selection,
      signal,
      callerRevision(task, selection),
    );
    try {
      await clarifications.run(data, async () => ({ kind: 'question', question }));
      assert.fail('An unanswered gate must stop the caller');
    } catch (error) {
      const gate = task
        .observations<{ clarification?: Clarification }>()
        .findLast(({ clarification }) => clarification?.question === question)!.clarification!;
      this.gates.push(gate);
      return error;
    } finally {
      task.ask = ask;
    }
  }

  /** Compare complete public answers and their canonical artifacts across staging recovery. */
  assertAnswers() {
    assert.deepEqual(
      this.held[0]!.answers.map(({ answer }) => answer),
      [answer],
    );
    assert.deepEqual(
      this.held[1]!.answers.map(({ answer }) => answer),
      [answer, pendingAnswer, continuationAnswer],
    );
    for (const held of this.held)
      for (const gate of held.answers) {
        assert(gate.evidence);
        assert.equal(
          JSON.parse(this.fixture.tasks[1]!.readFile(gate.evidence).text).answer,
          gate.answer,
        );
      }
  }

  /** Require actual unanswered action, scope and artifact; journal presence alone is insufficient. */
  assertGates() {
    for (const [index, held] of this.held.entries()) {
      assert.deepEqual(held.gates, [this.gates[index]]);
      assert.deepEqual(held.prerequisite, {
        kind: 'human-decision',
        satisfied: false,
        requiredAction: this.gates[index]!.question,
        evidence: [this.gates[index]!.evidence],
      });
      assert.equal(
        JSON.parse(this.fixture.tasks[1]!.readFile(held.gates[0]!.evidence!).text).question,
        this.gates[index]!.question,
      );
    }
  }

  /** Require both original and recovered reports with their exact complete source content. */
  assertResearch() {
    assert.deepEqual(this.held[0]!.research, this.research.slice(0, 1));
    assert.deepEqual(this.held[1]!.research, this.research);
    assert.deepEqual(
      this.held[1]!.research.map(({ evidence }) => this.fixture.tasks[1]!.readFile(evidence).text),
      reports,
    );
  }

  /** Require the original diagnostic in the actual prepared steward assignment after reopening. */
  assertSupplier() {
    assert.deepEqual(this.repairs, [this.diagnostic, this.diagnostic]);
  }
}

test('public caller scope matches actual executable-provider MCP before and after staging moves', async (t) => {
  const scenario = new CallerRecoveryScenario(t);
  await scenario.run();
  assert.equal(scenario.scopes[0]!.public, scenario.scopes[0]!.actual);
  assert.equal(
    scenario.scopes[1]!.public,
    scenario.scopes[1]!.actual,
    'Public caller scope differs from its actual MCP conversation',
  );
});

for (const consumer of ['Answers', 'Gates', 'Research', 'Supplier'] as const) {
  test('recovered public steward retains complete caller ' + consumer.toLowerCase(), async (t) => {
    const scenario = new CallerRecoveryScenario(t);
    await scenario.run();
    scenario[`assert${consumer}`]();
  });
}
