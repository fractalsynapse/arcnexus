import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Architecture, type Capture } from '../../../architecture/src/index.js';
import { GitHub } from '../../../collaboration/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { activities, track, type Milestone, type Plan } from '../../../direction/src/index.js';
import { Workflow, type WorkflowServices } from '../../../workflow/src/index.js';
import { Execution, HostTask, hostTask } from '../../src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';

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
  pushes: string[] = [];
  issues = 0;
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
    return undefined;
  }

  /** Observe the current branch head even after a lost push response. */
  override async remoteHead() {
    return this.head;
  }

  /** Simulate GitHub accepting the first push before its response was lost. */
  override async push(_root: string, branch: string, head: string, previous?: string) {
    assert.equal(branch, '7-task');
    assert.equal(previous, this.head);
    this.pushes.push(head);
    this.head = head;
    if (this.loseFirstPush && this.pushes.length === 1) throw new Error('Checkpoint push reply lost');
  }
}

/** Exercise Workflow, SQLite, checkout, checked edits and checkpoint commits over two attempts. */
class RecoveryScenario {
  readonly activations: string[] = [];
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
    t: TestContext,
    private readonly useTools = false,
    private readonly movedStaging = false,
  ) {
    const directory = mkdtempSync(join(tmpdir(), 'arcnexus-checkpoint-'));
    this.root = join(directory, 'project');
    this.storage = join(directory, 'state');
    t.after(() => rmSync(directory, { recursive: true, force: true }));
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
    this.capture = { ...this.capture, source: { ...this.capture.source, revision: staging } };
    return { oldBase, checkpoint, staging };
  }

  /** Read actual fixture Git objects for recovery assertions. */
  observe(...args: string[]) {
    return this.git(...args);
  }

  /** Supply the real execution ports with fake model and Collaboration boundaries. */
  private compose(t: TestContext): WorkflowServices {
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
  private admit(coordination: Coordination, goal: string, t: TestContext) {
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
    this.activations.push(id);
    if (id === 'second') assert(task.evidence.includes(this.artifacts[0]!));
    this.artifacts.push(task.store(`${id}.log`, id));
    assert(task.worktree);
    this.worktrees.push(task.worktree);
    if (id === 'second')
      assert.equal(readFileSync(join(task.worktree, 'first.txt'), 'utf8'), 'first');
    if (this.useTools) await this.editFiles(task, id, step);
    else task.edits('owner', step, [{ path: `${id}.txt`, expected: null, content: id }]);
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

  /** Initialize an exact base and two paths owned by one fixture steward. */
  private createSource() {
    mkdirSync(this.root);
    this.git('init');
    this.git('config', 'user.name', 'ArcNexus Fixture');
    this.git('config', 'user.email', 'arcnexus@example.invalid');
    writeFileSync(join(this.root, 'base.txt'), 'base');
    this.git('add', '.');
    this.git('commit', '-m', 'base');
    return {
      source: { root: this.root, remote, revision: this.git('rev-parse', 'HEAD') },
      project: { contractRegistry: 'contracts.yaml' },
      contracts: [],
      components: {
        owner: {
          id: 'owner',
          owns: ['first.txt', 'second.txt', 'extra.txt'],
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

test('retry confirms a lost checkpoint push, reconstructs the worktree and resumes the next steward', async (t) => {
  const scenario = new RecoveryScenario(t);
  const first = await scenario.run();
  assert.equal(first.kind, 'failed');
  assert.match(first.reason, /Checkpoint push reply lost/);
  assert.deepEqual(scenario.activations, ['first']);
  scenario.checkCleanup();

  const retry = await scenario.run();
  assert.equal(retry.kind, 'merged', JSON.stringify(retry));
  assert.deepEqual(scenario.activations, ['first', 'second']);
  assert.equal(scenario.remote.pushes.length, 2);
  assert.equal(dirname(scenario.artifacts[0]!), dirname(scenario.artifacts[1]!));
  assert.notEqual(scenario.artifacts[0], scenario.artifacts[1]);
  scenario.checkCleanup();
});

test('single-file tool checkpoints survive a refused write and interrupted push', async (t) => {
  const scenario = new RecoveryScenario(t, true);
  const interrupted = await scenario.run();
  assert.equal(interrupted.kind, 'failed');
  assert.match(interrupted.reason, /Checkpoint push reply lost/);
  assert.equal((await scenario.run()).kind, 'merged');
  assert.deepEqual(scenario.activations, ['first', 'first', 'second']);
  assert.equal(scenario.remote.pushes.length, 3);
  scenario.checkCleanup();
});

test('a secured checkpoint resumes on a disjoint staging advance', async (t) => {
  const scenario = new RecoveryScenario(t, false, true);
  const stopped = await scenario.run();
  assert.equal(stopped.kind, 'failed');
  assert.match(stopped.reason, /Interrupted after secured checkpoint/);
  const { oldBase, checkpoint, staging } = scenario.advance('staging-only.txt', 'staging contribution');
  const checkedBlob = scenario.observe('rev-parse', `${checkpoint}:first.txt`);
  const resumed = await scenario.run();
  assert.equal(resumed.kind, 'merged', JSON.stringify(resumed));
  assert.deepEqual(scenario.activations, ['first', 'second']);
  assert.equal(scenario.identities[0], scenario.identities[1]);
  assert.notEqual(scenario.worktrees[0], scenario.worktrees[1]);
  const recovered = scenario.observe('rev-parse', 'refs/heads/7-task');
  assert.equal(scenario.observe('merge-base', recovered, checkpoint), checkpoint);
  assert.equal(scenario.observe('merge-base', recovered, staging), staging);
  assert.equal(scenario.observe('rev-parse', `${recovered}:first.txt`), checkedBlob);
  assert.equal(scenario.observe('show', `${recovered}:staging-only.txt`), 'staging contribution');
  assert.notEqual(oldBase, staging);
  assert.ok(scenario.observe('rev-parse', `${recovered}^{tree}`));
});
