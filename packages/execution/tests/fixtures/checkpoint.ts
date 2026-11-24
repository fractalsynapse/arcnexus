import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { Architecture, type Capture } from '../../../architecture/src/index.js';
import { GitHub, type PublishedPull } from '../../../collaboration/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { activities, track, type Milestone, type Plan } from '../../../direction/src/index.js';
import { Workflow, type WorkflowServices } from '../../../workflow/src/index.js';
import { Execution, HostTask, hostTask } from '../../src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import { textDigest } from '../../../foundation/src/index.js';

const editTool = {
  name: 'checked-edit',
  handler: 'edit',
} as const;

const remote = 'https://github.com/fixture/repo.git';
const signal = new AbortController().signal;
const criterion = { id: 'files', description: 'Both owned files survive the checkpoint' };

const plan: Plan = {
  focus: {
    purpose: 'Resume the first unfinished activity',
    objectives: ['Keep both files'],
    constraints: ['Use one branch'],
  },
  milestones: [milestone('first'), milestone('second')],
};

/** Give each checkpoint one accountable activation in the production plan shape. */
function milestone(id: string): Milestone {
  return {
    id,
    owner: 'owner',
    criteria: [criterion],
    steps: activities.map((activity) => ({
      activity,
      ...(activity === 'implementation'
        ? { checklist: [{ id: activity, criteria: [criterion.id], expected: 'Write the file' }] }
        : { checklist: [], inapplicable: 'Outside this fixture' }),
    })),
  };
}

/** Observe and mutate a fixture remote without reaching GitHub. */
class CheckpointRemote extends GitHub {
  head?: string;
  staging?: string;
  published?: PublishedPull;
  loseRecoveryPush = false;
  pushes: string[] = [];
  issues = 0;
  readonly events: { kind: 'observe' | 'push'; branch: string; head?: string }[] = [];
  loseFirstPush = true;

  /** Bind the fixed fake repository without performing external operations. */
  constructor() {
    super(remote, signal);
  }

  /** Report absence of a previously created issue during initial setup. */
  override async findIssue() {
    return undefined;
  }

  /** Allocate one issue and account for duplicate creation attempts. */
  override async issue() {
    this.issues += 1;
    return '7';
  }

  /** Confirm the same journaled issue is used after interruption. */
  override async verifyIssue(issue: string) {
    assert.equal(issue, '7');
  }

  /** Model a branch that has not reached the publication phase. */
  override async publication() {
    return this.published;
  }

  /** Observe the current branch head even after a lost push response. */
  override async remoteHead(branch: string) {
    const head = branch === 'staging' ? this.staging : this.head;
    this.events.push({ kind: 'observe', branch, head });
    return head;
  }

  /** Simulate GitHub accepting the first push before its response was lost. */
  override async push(_root: string, branch: string, head: string, previous?: string) {
    assert.equal(branch, '7-task');
    assert.equal(previous, this.head);
    this.events.push({ kind: 'push', branch, head });
    this.pushes.push(head);
    this.head = head;
    if (
      (this.loseFirstPush && this.pushes.length === 1) ||
      (this.loseRecoveryPush && this.pushes.length === 2)
    )
      throw new Error('Checkpoint push reply lost');
  }
}

/** Exercise Workflow, SQLite, checkout, checked edits and checkpoint commits over two attempts. */
export class RecoveryScenario {
  readonly activations: string[] = [];
  beforeActivation?: (task: HostTask) => void;
  readonly artifacts: string[] = [];
  readonly remote = new CheckpointRemote();
  readonly root: string;
  readonly storage: string;
  readonly services: WorkflowServices;
  private capture: Capture;
  private interrupted = false;
  readonly worktrees: string[] = [];
  readonly identities: string[] = [];
  private task?: HostTask;
  private plans = 0;

  /** Build one real local Git base and isolated application storage. */
  constructor(
    t: Pick<TestContext, 'after' | 'mock'>,
    private readonly useTools = false,
    private readonly movedStaging = false,
    private readonly sharedFile = false,
    private readonly options: { directory?: string; abrupt?: boolean } = {},
  ) {
    const directory = options.directory ?? mkdtempSync(join(tmpdir(), 'arcnexus-checkpoint-'));
    this.root = join(directory, 'project');
    this.storage = join(directory, 'state');
    if (!options.directory) t.after(() => rmSync(directory, { recursive: true, force: true }));
    this.capture = this.createSource();
    this.remote.loseFirstPush = !movedStaging;
    this.services = this.compose(t);
  }

  /** Run a normal Workflow invocation with an unchanged logical goal. */
  run() {
    return new Workflow(this.services).run(
      { directory: this.root, goal: 'Checkpoint recovery fixture' },
      { progress() {} },
      signal,
    );
  }

  /** Assert that cleanup removed the run-owned worktree and retained the original checkout. */
  checkCleanup() {
    assert(this.task && !this.task.worktree);
    assert.equal(this.git('worktree', 'list', '--porcelain').split('worktree ').length, 2);
    assert(!existsSync(join(this.root, 'first.txt')));
    assert.equal(this.plans, 1);
    assert.equal(this.remote.issues, 1);
  }

  /** Advance the real staging tree and admit the next attempt at the observed revision. */
  advance(path: string, contents: string) {
    const oldBase = this.capture.source.revision;
    const checkpoint = this.git('rev-parse', 'refs/heads/7-task');
    mkdirSync(dirname(join(this.root, path)), { recursive: true });
    writeFileSync(join(this.root, path), contents);
    this.git('add', path);
    this.git('commit', '-m', 'Advance staging');
    const staging = this.git('rev-parse', 'HEAD');
    this.remote.staging = staging;
    this.capture = { ...this.capture, source: { ...this.capture.source, revision: staging } };
    return { oldBase, checkpoint, staging };
  }

  /** Represent a newly admitted approved ownership mapping without changing retained history. */
  reassignFirstFile() {
    this.capture.components.owner!.owns = ['second.txt', 'extra.txt', 'shared.txt'];
    this.capture.components.other!.owns = ['base.txt', 'first.txt'];
  }

  /** Represent an approved removal of the next required activity at new admission. */
  removePendingActivity() {
    this.capture.components.owner!.activities = {};
  }

  /** Recreate the exact clean retained workspace that an abrupt exit leaves behind. */
  abandonWorkspace() {
    const path = this.worktrees.at(-1)!;
    mkdirSync(dirname(path), { recursive: true });
    this.git('worktree', 'add', path, '7-task');
    return path;
  }

  /** Read actual fixture Git objects for recovery assertions. */
  observe(...args: string[]) {
    return this.git(...args);
  }

  /** Supply the real execution ports with fake model and Collaboration boundaries. */
  private compose(t: Pick<TestContext, 'after' | 'mock'>): WorkflowServices {
    const coordination = new Coordination(this.storage);
    const execution = new Execution(new Architecture(), coordination, this.storage);
    return {
      execution: {
        admit: async ({ goal }) => this.admit(coordination, goal, t),
        assemble: (session, abort) => execution.assemble(session, abort),
        prepare: (session, issue, abort) => execution.prepare(session, issue, abort),
        checkpoint: async (session, activity, abort) => {
          await execution.checkpoint(session, activity, abort);
          if (this.movedStaging && !this.interrupted) {
            this.interrupted = true;
            throw new Error('Interrupted after secured checkpoint');
          }
        },
      },
      direction: {
        track,
        plan: async () => {
          this.plans += 1;
          return { kind: 'plan', plan };
        },
        revise: async () => assert.fail('No plan revision is required'),
      },
      agent: {
        execute: async (session, selected, step) => this.edit(hostTask(session), selected.id, step),
      },
      ...this.gates,
    };
  }

  private readonly gates: Pick<WorkflowServices, 'verification' | 'delivery'> = {
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

  /** Claim the same logical task using real Coordination and an isolated provider. */
  private admit(coordination: Coordination, goal: string, t: Pick<TestContext, 'after' | 'mock'>) {
    const journal = coordination.admit(remote, goal);
    assert('record' in journal);
    const task = new HostTask(
      {
        capture: this.capture,
        common: join(this.root, '.git'),
        executable: '',
        base: 'staging',
        fresh: true,
        storage: this.storage,
      },
      goal,
      journal,
    );
    t.mock.method(task, 'provider', () => this.remote);
    this.task = task;
    this.identities.push(task.taskID);
    return task;
  }

  /** Apply owned edits through the production path and observe the recovered first contribution. */
  private async edit(task: HostTask, id: string, step: string) {
    this.beforeActivation?.(task);
    this.activations.push(id);
    if (id === 'second') assert(task.evidence.includes(this.artifacts[0]!));
    this.artifacts.push(task.store(`${id}.log`, id));
    assert(task.worktree);
    this.worktrees.push(task.worktree);
    if (id === 'second')
      assert.equal(readFileSync(join(task.worktree, 'first.txt'), 'utf8'), 'first');
    if (this.useTools) await this.editFiles(task, id, step);
    else task.edits('owner', step, [{ path: `${id}.txt`, expected: null, content: id }]);
    if (this.sharedFile && id === 'first')
      task.edits('owner', step, [
        {
          path: 'shared.txt',
          expected: textDigest('top\n\nmiddle\n\nbottom\n'),
          content: 'steward\n\nmiddle\n\nbottom\n',
        },
      ]);
    return { kind: 'completed' as const, evidence: [] };
  }

  /** Exercise a retained file receipt, a refused file, and a second independent write. */
  private async editFiles(task: HostTask, id: string, step: string) {
    const actions = new ActivationTools(
      task,
      { component: 'owner', activity: step },
      { milestone: id },
      signal,
    );
    const first = { path: `${id}.txt`, expected: null, content: id };
    const receipt = await actions.invoke(editTool, first);
    if (this.options.abrupt) this.exitAfterAcknowledgment(task, receipt);
    assert.deepEqual(await actions.invoke(editTool, first), receipt);
    if (id !== 'first') return;
    await assert.rejects(
      actions.invoke(editTool, { ...first, path: 'base.txt' }),
      /captured owners: other/,
    );
    assert.equal(readFileSync(join(task.worktree!, first.path), 'utf8'), id);
    assert.equal(readFileSync(join(task.worktree!, 'base.txt'), 'utf8'), 'base');
    await actions.invoke(editTool, { ...first, path: 'extra.txt' });
    assert.throws(() => actions.finish({ kind: 'completed', edits: [first] }), /mapped MCP tools/);
  }

  /** Leave the real acknowledged checkpoint and workspace untouched by normal cleanup. */
  private exitAfterAcknowledgment(task: HostTask, receipt: unknown): never {
    const artifact = task.store('acknowledged-edit.json', JSON.stringify(receipt));
    writeFileSync(join(dirname(this.root), 'acknowledgment.json'), JSON.stringify({
      receipt, artifact, taskID: task.taskID, issue: task.issue,
      branch: task.branch, worktree: task.worktree, node: process.version,
    }));
    process.exit(73);
  }

  /** Expose durable observations for assertions about original receipt and edit identities. */
  observations<T>() {
    assert(this.task);
    return this.task.observations<T>();
  }

  /** Initialize an exact base and two paths owned by one fixture steward. */
  private createSource() {
    if (!existsSync(this.root)) this.initializeSource();
    return this.captureSource();
  }

  /** Commit the generic fixture independently of developer state or credentials. */
  private initializeSource() {
    mkdirSync(this.root);
    this.git('init');
    this.git('config', 'user.name', 'ArcNexus Fixture');
    this.git('config', 'user.email', 'arcnexus@example.invalid');
    writeFileSync(join(this.root, 'base.txt'), 'base');
    if (this.sharedFile) writeFileSync(join(this.root, 'shared.txt'), 'top\n\nmiddle\n\nbottom\n');
    writeFileSync(join(this.root, 'contracts.yaml'), 'contracts: []\n');
    this.git('add', '.');
    this.git('commit', '-m', 'base');
  }

  /** Supply the captured authority read by the actual HostTask and checkpoint lifecycle. */
  private captureSource() {
    return {
      source: { root: this.root, remote, revision: this.git('rev-parse', 'HEAD') },
      project: { contractRegistry: 'contracts.yaml' },
      contracts: [],
      standards: {},
      components: {
        owner: {
          id: 'owner',
          owns: ['first.txt', 'second.txt', 'extra.txt', 'shared.txt'],
          activities: { implementation: { profile: 'fixture' } },
        },
        other: { id: 'other', owns: ['base.txt'], activities: {} },
      },
    } as unknown as Capture;
  }

  /** Run a local repository command on the fixture. */
  private git(...args: string[]) {
    return execFileSync('git', args, {
      cwd: this.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  }
}
