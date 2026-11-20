import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import {
  Architecture,
  resolveOperation,
  type TaskContext,
} from '../../../architecture/src/index.js';
import { GitHub } from '../../../collaboration/src/index.js';
import { Coordination, Journal } from '../../../coordination/src/index.js';
import { activities, type Milestone, type Plan } from '../../../direction/src/index.js';
import { textDigest } from '../../../foundation/src/index.js';
import type { ActivityOutcome } from '../../../workflow/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import type { CheckResult } from '../../src/check.js';
import { git } from '../../src/git.js';
import { Clarifications, HostTask, steward } from '../../src/index.js';
import { execute } from '../../src/process.js';
import { CheckDependencies } from '../../src/dependencies.js';
import { runCheck } from '../../src/run-check.js';
import { holdFiles } from './reviewed-hold-project.js';

export const selection = { component: 'owner', activity: 'implementation' };
export const question = 'Which inputs govern the rejected criterion?';
export const answer = '  Use fixture.txt.\n\nKeep the original acceptance and schema authority.  ';
const signal = new AbortController().signal;
const remote = 'https://github.com/example/reviewed-hold.git';

export const correction: Milestone = {
  id: 'review-correction',
  owner: 'owner',
  criteria: [
    { id: 'original-criterion', description: 'Preserve the independently reviewed behavior' },
  ],
  steps: activities.map((activity) => ({
    activity,
    ...(activity === 'implementation'
      ? {
          checklist: [
            { id: 'correct', criteria: ['original-criterion'], expected: 'Repair fixture.txt' },
          ],
        }
      : { checklist: [], inapplicable: 'Outside this boundary scenario' }),
  })),
};

const focus = {
  purpose: 'Correct independent rejection without losing context',
  objectives: ['Keep original acceptance'],
  constraints: ['Preserve captured authority'],
};

/** Retain real Git/SQLite state while isolating only model, command confinement and remote transport. */
export class ReviewedHoldFixture {
  readonly directory = mkdtempSync(join(tmpdir(), 'arcnexus-reviewed-hold-'));
  readonly root = join(this.directory, 'project');
  readonly storage = join(this.directory, 'state');
  task: HostTask;
  readonly checks: CheckResult[] = [];
  readonly milestone: Milestone;
  readonly receipts: unknown[] = [];
  readonly rejection;
  readonly originalReport = 'Independent rejection A\nKeep the exact originating finding.\n';
  private head?: string;
  private refusal = false;
  private dependencyPrerequisite = false;

  /** Commit a complete explicit catalog before capture and admit the real journal. */
  constructor(
    private readonly t: TestContext,
    private readonly external = false,
    private readonly relevance?: 'arguments' | 'selection',
  ) {
    this.milestone = relevance
      ? {
          ...correction,
          steps: correction.steps.map((step) => ({
            ...step,
            checklist: step.checklist.map((item) => ({
              ...item,
              expected: 'Repair reviewed behavior',
            })),
          })),
        }
      : correction;
    mkdirSync(this.root);
    this.source();
    this.task = this.open();
    this.rejection = this.reviewEvidence();
    this.recordReview();
    t.after(() => {
      this.task.close();
      rmSync(this.directory, { recursive: true, force: true });
    });
  }

  /** Preserve distinguishable full rejection artifacts without recursively copying transcripts. */
  private reviewEvidence() {
    const report = this.task.store('independent-review.md', this.originalReport);
    return {
      kind: 'rejection' as const,
      findings: [
        {
          owner: 'owner',
          criterion: 'original-criterion',
          reason: this.relevance
            ? 'Reviewed context A is lost'
            : 'fixture.txt loses reviewed context A',
          evidence: [report],
        },
        {
          owner: 'other',
          criterion: 'foreign-criterion',
          reason: 'Distinct independent finding B',
          evidence: [this.task.store('foreign-review.md', 'Independent rejection B\n')],
        },
      ],
    };
  }

  /** Write committed source, registry, bindings, profile and ownership with no live developer inputs. */
  private source() {
    git(this.root, 'init', '-b', 'staging');
    git(this.root, 'config', 'user.name', 'Hold fixture');
    git(this.root, 'config', 'user.email', 'hold@example.invalid');
    git(this.root, 'remote', 'add', 'origin', remote);
    const files = { ...holdFiles };
    if (this.external) files['package.json'] = '{"name":"prerequisite-fixture","private":true}';
    const path = '.arc/architecture/operations/owner-tests.yaml';
    const operation = JSON.parse(files[path]!);
    operation.args.push(this.external ? 'external' : 'local');
    if (this.relevance) operation.args.push('stable');
    if (this.relevance === 'arguments') operation.args.push('fixture.txt');
    files[path] = JSON.stringify(operation);
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(this.root, path)), { recursive: true });
      writeFileSync(join(this.root, path), content);
    }
    git(this.root, 'add', '.');
    git(this.root, 'commit', '-m', 'Explicit hold fixture');
  }

  /** Re-admit the same goal and isolate Collaboration without replacing checkpoint commits. */
  private open() {
    const capture = new Architecture().capture(this.root);
    const journal = new Coordination(this.storage).admit(remote, focus.purpose);
    assert(journal instanceof Journal);
    const task = new HostTask(
      {
        capture,
        common: join(this.root, '.git'),
        executable: '',
        base: 'staging',
        fresh: true,
        storage: this.storage,
      },
      focus.purpose,
      journal,
    );
    const provider = new GitHub(remote, signal);
    this.t.mock.method(provider, 'remoteHead', async () => this.head);
    this.t.mock.method(provider, 'publication', async () => undefined);
    this.t.mock.method(provider, 'push', async (_root: string, _branch: string, head: string) => {
      this.head = head;
    });
    this.t.mock.method(task, 'provider', () => provider);
    this.bind(task);
    return task;
  }

  /** Model only the actual provider response; retain real steward decoding and checked effects. */
  private bind(task: HostTask) {
    this.t.mock.method(
      task,
      'activate',
      async (_agent: Agent, _selection: unknown, data: TaskContext) => this.reply(task, data),
    );
    this.t.mock.method(
      task,
      'check',
      async (id: string, abort: AbortSignal, scope?: Parameters<HostTask['check']>[2]) => {
        const check = this.dependencyPrerequisite
          ? await runCheck(task, id, abort, scope)
          : await this.command(task, id, abort);
        if (!this.dependencyPrerequisite)
          task.note({
            check,
            scope,
            checkInput: textDigest(readFileSync(join(task.worktree!, 'fixture.txt'), 'utf8')),
          });
        this.checks.push(check);
        return check;
      },
    );
  }

  /** Keep provider prose distinguishable from actual scope, checks and host receipts. */
  private reply(task: HostTask, data: TaskContext) {
    assert.deepEqual(data.acceptance, this.milestone.criteria);
    assert.deepEqual((data.assignment as { finding: unknown }).finding, {
      kind: 'rejection',
      findings: [this.rejection.findings[0]],
    });
    const reply = {
      kind: 'completed',
      summary: 'Model claims progress and schema availability; neither claim is evidence.',
      edits: this.refusal ? [{ path: 'schema.txt', expected: null, content: 'unauthorized' }] : [],
      checks: [],
    };
    task.store('controlled-provider.json', JSON.stringify(reply));
    return reply;
  }

  /** Run a real subprocess in Testing's outer sandbox; this does not prove native HostTask confinement. */
  private async command(task: HostTask, id: string, abort: AbortSignal) {
    const log = task.artifact('controlled-check.log');
    const operation = resolveOperation(task.capture, id, 'owner', 'implementation');
    assert(operation?.command);
    const { command, args } = operation;
    const cwd = task.worktree!;
    const start = performance.now();
    const observed = await execute(command, args, { cwd, log, signal: abort });
    const check: CheckResult = {
      id,
      command,
      args,
      cwd,
      log,
      status: observed.status,
      durationMs: performance.now() - start,
      diagnostic: observed.stderr.trim(),
      ...(this.relevance === 'selection'
        ? { selection: { operation: 'lint' as const, owner: 'owner', files: ['fixture.txt'] } }
        : {}),
    };
    return check;
  }

  /** Persist an independent verdict and its Direction revision using production event shapes. */
  private recordReview() {
    const original = { ...this.milestone, id: 'original' };
    const digest = git(this.root, 'rev-parse', 'HEAD^{tree}');
    const foreign = {
      ...original,
      id: 'foreign',
      owner: 'other',
      criteria: [{ id: 'foreign-criterion', description: 'Preserve the external schema' }],
    };
    const plan: Plan = { focus, milestones: [original, foreign] };
    this.task.record({ plan });
    this.task.record({
      candidate: { digest, evidence: [] },
      verdict: { kind: 'rejected', candidate: digest, findings: this.rejection.findings },
    });
    this.task.record({ feedback: this.rejection });
    this.task.record({ plan: { focus, milestones: [this.milestone, ...plan.milestones] } });
    this.task.record({ position: { completed: 0, activities: { [this.milestone.id]: 2 } } });
  }

  /** Prepare the real issue branch and record one full answered clarification through its host API. */
  async prepare() {
    this.task.store(
      'controlled-runtime.json',
      JSON.stringify({
        executable: process.execPath,
        version: process.version,
        boundary: 'Real subprocess in outer Testing sandbox; controlled HostTask.check seam',
      }),
    );
    await this.task.setupWorkspace('699', signal);
    this.task.ask = async () => answer;
    await new Clarifications(this.task, selection, signal).decide(
      { milestone: { id: this.milestone.id }, acceptance: this.milestone.criteria },
      question,
    );
    await this.edit('unrelated.txt', 'acknowledged before hold');
    await this.task.check('owner-tests', signal, {
      owner: 'owner',
      activity: 'implementation',
      expected: 'pass',
    });
  }

  /** Secure one acknowledged file using the actual checked-edit/checkpoint boundary. */
  async edit(path: string, content: string) {
    const expected = textDigest(readFileSync(join(this.task.worktree!, path), 'utf8'));
    const tools = new ActivationTools(
      this.task,
      selection,
      { milestone: { id: this.milestone.id }, acceptance: this.milestone.criteria },
      signal,
    );
    const receipt = await tools.invoke(
      { name: 'checked-edit', handler: 'edit' },
      { path, expected, content },
    );
    this.receipts.push(receipt);
    return receipt;
  }

  /** Produce a host hold through the public Execution steward boundary, never a model blocked claim. */
  run(): Promise<ActivityOutcome> {
    return steward(
      new Agent(new Architecture()),
      this.task,
      this.milestone,
      'implementation',
      signal,
    );
  }

  /** Reopen durable state and reconstruct a clean worktree from the same secured checkpoint. */
  async restart() {
    this.task.cleanup();
    this.task.finish({
      kind: 'blocked',
      reason: 'Retained steward hold',
      evidence: this.task.evidence,
    });
    this.task.close();
    this.task = this.open();
    await this.task.setupWorkspace('699', signal);
  }

  /**
   * Exercise runCheck's host prerequisite classification with a controlled preparation
   * collaborator. Its real subprocess diagnostic is retained; this proves neither
   * npm installation nor native confinement.
   */
  requireDependencies() {
    this.dependencyPrerequisite = true;
    this.t.mock.method(CheckDependencies.prototype, 'prepare', async (abort: AbortSignal) => {
      const result = {
        ...(await this.command(this.task, 'owner-tests', abort)),
        id: 'dependencies',
      };
      this.task.note({ dependencyPreparation: result });
      return result;
    });
  }

  /** Exercise a real checked-edit refusal after earlier acknowledged work. */
  refuseForeignEdit() {
    this.refusal = true;
  }

  /** Read checkpoint identity directly from real Git, independently of a projected hold context. */
  checkpoint() {
    return git(this.task.worktree!, 'rev-parse', 'HEAD');
  }
}
