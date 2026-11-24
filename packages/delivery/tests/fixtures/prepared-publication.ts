import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { Agent } from '../../../agent/src/index.js';
import { GitHub } from '../../../collaboration/src/index.js';
import { textDigest } from '../../../foundation/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { activities, track, type Plan } from '../../../direction/src/index.js';
import { Workflow, type WorkflowServices } from '../../../workflow/src/index.js';
import { Execution, hostTask, type HostTask } from '../../../execution/src/index.js';
import { RoundConsumptionFixture } from '../../../execution/tests/fixtures/round-consumption.js';

import { verify } from '../../../verification/src/index.js';
import { integrate, resume } from '../../src/index.js';
import { assertExecutedChecks } from './recovery-evidence.js';
import type { CheckResult } from '../../../execution/src/check.js';

export const answer = '  Preserve the original requirement.\n\nKeep café and trailing spaces.  \n';
export const continuationQuestion = 'Which newly captured requirement governs this continuation?';
export const continuationAnswer =
  '  Use the newly captured ownership.\n\nRetain original café requirements.  \n';
export const checked = 'secured checked bytes café\nsecond line\n';
export const criterion = {
  id: 'continuity',
  description: 'Preserve checked bytes and exact answers',
};

const catalog = '.arc/architecture';
const signal = new AbortController().signal;
const goal = 'Recover one prepared task after staging moves';

/** Exercise real admission, preparation, activation, SQLite and Git with controlled publication. */
export class PreparedRecoveryFixture extends RoundConsumptionFixture {
  readonly tasks: HostTask[] = [];
  private readonly retainedArtifacts = new Set<string>();
  readonly observed: Array<ReturnType<HostTask['observations']>> = [];
  readonly prompts: string[] = [];
  readonly checkpoints: string[] = [];
  readonly provider = new GitHub('https://github.com/example/round-consumption.git', signal);
  readonly reviews: unknown[] = [];
  issues = 0;
  plans = 0;
  private head?: string;
  private interrupted = false;
  interruptNext = false;
  repairFailedCheck = false;
  recoveryContinuation?: 'replay' | 'question';

  /** Commit explicit tools and ownership and bind an executable deterministic provider. */
  constructor(private readonly context: TestContext) {
    super(context);
    this.configure();
    const source = readFileSync(
      fileURLToPath(
        new URL('../../../execution/tests/fixtures/prepared-recovery-provider.js', import.meta.url),
      ),
      'utf8',
    );
    const executable = join(this.root, '.git', 'prepared-provider.mjs');
    writeFileSync(executable, source.replace(/^#![^\n]*/, '#!' + process.execPath), {
      mode: 0o700,
    });
    this.write('.git/bindings.yaml', { schemaVersion: 1, tools: { codex: executable } });
    this.mockProvider();
  }

  /** Reopen production services against the same durable project identity. */
  run() {
    const execution = new Execution(
      this.architecture,
      new Coordination(this.storage),
      this.storage,
    );
    const agent = new Agent(this.architecture);
    return new Workflow({
      execution: this.execution(execution),
      direction: this.direction(),
      agent: {
        execute: async (session, milestone) => {
          const task = hostTask(session);
          if (milestone.id === 'correct-required-check') this.correctBaseline(task);
          return this.activate(task, agent);
        },
      },
      ...this.gates(),
    })
      .run({ directory: this.root, goal }, this.observer(), signal)
      .then((outcome) => {
        this.retainArtifacts();
        return outcome;
      });
  }

  /** Preserve the accepted plan and append only accountable correction after rejection. */
  private direction(): WorkflowServices['direction'] {
    return {
        track,
        plan: async () => {
          this.plans += 1;
          return { kind: 'plan', plan: recoveryPlan() };
        },
        revise: async (_session, plan, feedback) => {
          assert(this.repairFailedCheck && feedback.kind === 'rejection');
          assert(plan);
          const correction = { ...plan.milestones[0]!, id: 'correct-required-check' };
          return { kind: 'plan', plan: { ...plan, milestones: [...plan.milestones, correction] } };
        },
    };
  }

  /** Retain each native source artifact once in the enclosing check log before temporary cleanup. */
  private retainArtifacts() {
    for (const task of this.tasks) {
      for (const path of task.evidence) {
        if (this.retainedArtifacts.has(path) || path.endsWith('run-timeline.jsonl')) continue;
        this.retainedArtifacts.add(path);
        const text = readFileSync(path, 'utf8');
        this.context.diagnostic(
          JSON.stringify({
            controlledRecoveryArtifact: { path, sha256: textDigest(text), text },
          }),
        );
      }
    }
  }

  /** Supply the actual foreground answer handler that Workflow binds to each admitted session. */
  private observer() {
    return {
      progress() {},
      answer: async (question: string) => {
        this.prompts.push(question);
        return question === continuationQuestion ? continuationAnswer : answer;
      },
    };
  }

  /** Move staging with a committed contribution, new operation and new applicable check. */
  advance(path = 'staging.txt', content = 'independent staging contribution\n') {
    const oldBase = this.git('rev-parse', 'HEAD');
    const checkpoint = this.git('rev-parse', '7-task');
    this.write(path, content);
    this.write(catalog + '/operations/current-read.yaml', {
      id: 'current-read',
      category: 'read',
      tool: 'read',
    });
    const owner = this.definition('components/work');
    owner.activities.implementation.operations.push('current-read');
    this.write(catalog + '/components/work.yaml', owner);
    const project = this.definition('project');
    project.checks.acceptance.push('current-check');
    this.write(catalog + '/project.yaml', project);
    this.write(catalog + '/operations/current-check.yaml', {
      id: 'current-check',
      category: 'check',
      tool: 'check',
      command: process.execPath,
      args: ['recovery-check.mjs', 'current'],
      network: false,
    });
    this.git('add', '.');
    this.git('commit', '-m', 'Advance accepted staging capture');
    return { oldBase, checkpoint, staging: this.git('rev-parse', 'HEAD') };
  }

  /** Preserve production admission and preparation while isolating hosted transport. */
  private execution(execution: Execution): WorkflowServices['execution'] {
    return {
      admit: async (input, cancellation) => {
        const task = await execution.admit(input, cancellation);
        assert(!('kind' in task), JSON.stringify(task));
        const admitted = hostTask(task);
        this.tasks.push(admitted);
        const close = admitted.close.bind(admitted);
        this.context.mock.method(admitted, 'close', () => {
          this.observed.push(admitted.observations());
          close();
        });
        this.context.mock.method(admitted, 'provider', () => this.provider);
        this.controlReviewer(admitted);
        return admitted;
      },
      prepare: (task, issue, cancellation) => execution.prepare(task, issue, cancellation),
      checkpoint: (task, activity, cancellation) =>
        execution.checkpoint(task, activity, cancellation),
      assemble: (task, cancellation) => execution.assemble(task, cancellation),
    };
  }

  /** Repair the accountable input through checked editing before Workflow checkpoints it. */
  private correctBaseline(task: HostTask) {
    const baseline = readFileSync(join(task.worktree!, 'baseline'), 'utf8');
    task.edits('work', 'implementation', [
      { path: 'baseline', expected: textDigest(baseline), content: 'durable evidence\n' },
    ]);
  }

  /** Replace only the external review response, retaining the real identity and citation validators. */
  private controlReviewer(task: HostTask) {
    const activate = task.activate.bind(task);
    this.context.mock.method(
      task,
      'activate',
      async (...[agent, selection, data, cancellation]: Parameters<HostTask['activate']>) => {
        if (selection.component !== 'reviewer')
          return activate(agent, selection, data, cancellation);
        this.reviews.push(structuredClone(data));
        return this.reviewReply(task, data);
      },
    );
  }

  /** Model a favorable verdict or an evidence-linked rejection of the actual failed command. */
  private reviewReply(task: HostTask, data: Parameters<HostTask['activate']>[2]) {
    const assignment = data.assignment as {
          accepted: Record<string, unknown>;
          checks: CheckResult[];
        };
        assertExecutedChecks(task, assignment.checks);
        const failed = assignment.checks.find(({ status }) => status !== 0);
        if (this.repairFailedCheck && failed)
          return {
            ...assignment.accepted,
            kind: 'rejected',
            findings: [{
              criterion: criterion.id,
              owner: 'work',
              reason: 'Correct the baseline rejected by the required command',
              evidence: [failed.log],
            }],
          };
        return {
          ...assignment.accepted,
          kind: 'accepted',
          criteria: [criterion.id],
          evidence: task.evidence,
        };
  }

  /** Interrupt after the answer is durable but before activity completion is acknowledged. */
  private async activate(task: HostTask, agent: Agent) {
    const result = await task.activate(
      agent,
      { component: 'work', activity: 'implementation' },
      {
        assignment: {
          instructions: 'Continue the original checked contribution',
          recoveryContinuation: this.recoveryContinuation,
        },
        milestone: { id: 'recover' },
        acceptance: [criterion],
        evidence: [],
      },
      signal,
    );
    this.observed.push(task.observations());
    if (!this.interrupted || this.interruptNext) {
      this.interrupted = true;
      this.interruptNext = false;
      throw new Error('Interrupted after checked receipt and verbatim answer');
    }
    assert.deepEqual(result, { kind: 'completed', edits: [], checks: [] });
    return { kind: 'completed' as const, evidence: [] };
  }

  /** Run production checks and independent assessment before the actual Delivery service. */
  private gates(): Pick<WorkflowServices, 'verification' | 'delivery'> {
    return {
      verification: {
        assess: (session, plan, candidate, cancellation) =>
          verify(new Agent(this.architecture), session, plan, candidate, cancellation),
      },
      delivery: { integrate, resume },
    };
  }

  /** Model external GitHub facts, retaining one issue and the secured remote head. */
  private mockProvider() {
    const mock = this.context.mock;
    mock.method(this.provider, 'publication', async () => undefined);
    mock.method(this.provider, 'findIssue', async () => undefined);
    mock.method(this.provider, 'issue', async () => {
      this.issues += 1;
      return '7';
    });
    mock.method(this.provider, 'verifyIssue', async (issue: string) => assert.equal(issue, '7'));
    mock.method(this.provider, 'remoteHead', async (branch: string) =>
      branch === 'staging' ? this.git('rev-parse', 'HEAD') : this.head,
    );
    mock.method(this.provider, 'push', async (_: string, branch: string, head: string) => {
      assert.equal(branch, '7-task');
      this.checkpoints.push(head);
      this.head = head;
    });
  }

  /** Commit a complete steward activity with actual mapped edit and question handlers. */
  private configure() {
    const work = this.definition('components/work');
    work.owns = ['baseline', 'checked.txt', 'staging.txt', 'recovery-check.mjs'];
    work.activities = {
      implementation: {
        role: 'assessor',
        profile: 'work',
        instructions: ['Preserve original acceptance'],
        operations: ['checked-edit', 'ask-question'],
        standards: [],
      },
    };
    this.write(catalog + '/components/work.yaml', work);
    this.write(catalog + '/operations/checked-edit.yaml', {
      id: 'checked-edit',
      category: 'read',
      tool: 'edit',
    });
    this.installChecks();
    this.git('add', '.');
    this.git('commit', '-m', 'Explicit prepared recovery activity');
  }

  /** Commit compiler output from the maintained TypeScript fixture and the original command. */
  private installChecks() {
    const script = readFileSync(new URL('./recovery-check.js', import.meta.url), 'utf8');
    this.write('recovery-check.mjs', script);
    this.write(catalog + '/operations/fixture-check.yaml', {
      id: 'fixture-check',
      category: 'check',
      tool: 'check',
      command: process.execPath,
      args: ['recovery-check.mjs', 'original'],
      network: false,
    });
  }

  /** Read the complete authored definition before changing the next captured revision. */
  private definition(path: string) {
    return parse(readFileSync(join(this.root, catalog, path + '.yaml'), 'utf8'));
  }

  /** Write explicit fixture records before their committed capture. */
  private write(path: string, data: unknown) {
    mkdirSync(dirname(join(this.root, path)), { recursive: true });
    writeFileSync(join(this.root, path), typeof data === 'string' ? data : stringify(data));
  }
}

/** Preserve original requirements and the real ordered plan shape through every retry. */
function recoveryPlan(): Plan {
  return {
    focus: {
      purpose: goal,
      objectives: ['Keep the original requirement'],
      constraints: ['Retain the original issue and acceptance'],
    },
    milestones: [
      {
        id: 'recover',
        owner: 'work',
        criteria: [criterion],
        steps: activities.map((activity) => ({
          activity,
          ...(activity === 'implementation'
            ? {
                checklist: [
                  { id: 'recover', criteria: [criterion.id], expected: criterion.description },
                ],
              }
            : { checklist: [], inapplicable: 'Outside this Execution regression' }),
        })),
      },
    ],
  };
}
