import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { Agent } from '../../../agent/src/index.js';
import { GitHub } from '../../../collaboration/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { activities, track, type Plan } from '../../../direction/src/index.js';
import { Workflow, type WorkflowServices } from '../../../workflow/src/index.js';
import { Execution, hostTask, type HostTask } from '../../src/index.js';
import { RoundConsumptionFixture } from './round-consumption.js';

export const answer = '  Preserve the original requirement.\n\nKeep café and trailing spaces.  \n';
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
  readonly observed: Array<ReturnType<HostTask['observations']>> = [];
  readonly prompts: string[] = [];
  readonly checkpoints: string[] = [];
  readonly provider = new GitHub('https://github.com/example/round-consumption.git', signal);
  issues = 0;
  plans = 0;
  private head?: string;
  private interrupted = false;
  interruptNext = false;

  /** Commit explicit tools and ownership and bind an executable deterministic provider. */
  constructor(private readonly context: TestContext) {
    super(context);
    this.configure();
    const source = readFileSync(
      fileURLToPath(new URL('./prepared-recovery-provider.js', import.meta.url)),
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
      direction: {
        track,
        plan: async () => {
          this.plans += 1;
          return { kind: 'plan', plan: recoveryPlan() };
        },
        revise: async () => assert.fail('Recovery must retain the accepted plan'),
      },
      agent: { execute: async (session) => this.activate(hostTask(session), agent) },
      ...this.gates(),
    }).run({ directory: this.root, goal }, { progress() {} }, signal);
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
      args: ['--version'],
      network: false,
    });
    this.git('add', '.');
    this.git('commit', '-m', 'Advance accepted staging capture');
    return { oldBase, checkpoint, staging: this.git('rev-parse', 'HEAD') };
  }

  /** Commit changed ownership or missing activity instead of mutating a synthetic capture. */
  changeOwner(unavailable = false) {
    const owner = this.definition('components/work');
    if (unavailable) owner.activities = {};
    else owner.owns = ['baseline'];
    this.write(catalog + '/components/work.yaml', owner);
    if (!unavailable) {
      const reviewer = this.definition('components/reviewer');
      reviewer.owns.push('checked.txt', 'staging.txt');
      this.write(catalog + '/components/reviewer.yaml', reviewer);
    }
    this.git('add', '.');
    this.git('commit', '-m', 'Change current captured authority');
  }

  /** Retrieve complete native observations from their canonical artifacts. */
  probes(task: HostTask) {
    return task.evidence
      .filter((path) => path.endsWith('codex.jsonl'))
      .flatMap((path) =>
        readFileSync(path, 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line)),
      )
      .filter((event) => event.type === 'fixture.prepared');
  }

  /** Preserve production admission and preparation while isolating hosted transport. */
  private execution(execution: Execution): WorkflowServices['execution'] {
    return {
      admit: async (input, cancellation) => {
        const task = await execution.admit(input, cancellation);
        assert(!('kind' in task), JSON.stringify(task));
        const admitted = hostTask(task);
        this.tasks.push(admitted);
        this.context.mock.method(admitted, 'provider', () => this.provider);
        admitted.ask = async (question) => {
          this.prompts.push(question);
          return answer;
        };
        return admitted;
      },
      prepare: (task, issue, cancellation) => execution.prepare(task, issue, cancellation),
      checkpoint: (task, activity, cancellation) =>
        execution.checkpoint(task, activity, cancellation),
      assemble: (task, cancellation) => execution.assemble(task, cancellation),
    };
  }

  /** Interrupt after the answer is durable but before activity completion is acknowledged. */
  private async activate(task: HostTask, agent: Agent) {
    const result = await task.activate(
      agent,
      { component: 'work', activity: 'implementation' },
      {
        assignment: { instructions: 'Continue the original checked contribution' },
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

  /** Keep final verification and delivery explicitly outside this Execution claim. */
  private gates(): Pick<WorkflowServices, 'verification' | 'delivery'> {
    return {
      verification: {
        assess: async (_session, _plan, candidate) => ({
          kind: 'accepted',
          candidate: candidate.digest,
          criteria: [criterion.id],
          evidence: [],
        }),
      },
      delivery: {
        integrate: async (_session, candidate) => ({
          kind: 'merged',
          commit: candidate.digest,
          evidence: [],
        }),
      },
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
    work.owns = ['baseline', 'checked.txt', 'staging.txt'];
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
    this.git('add', '.');
    this.git('commit', '-m', 'Explicit prepared recovery activity');
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
    focus: { purpose: goal, objectives: ['Keep the original requirement'], constraints: [] },
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
