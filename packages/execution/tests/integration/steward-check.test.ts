import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type Capture, type TaskContext } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { activities, type Milestone, type Plan } from '../../../direction/src/index.js';
import { Workflow, type WorkflowServices } from '../../../workflow/src/index.js';
import { HostTask, steward } from '../../src/index.js';

const agent = new Agent(new Architecture());
const criterion = { id: 'fixed', description: 'The fixture check passes' };
const focus = {
  purpose: 'Correct the fixture',
  objectives: ['Pass the check'],
  constraints: ['Stay in scope'],
};

/** Describe the original and correcting work with the same engineering acceptance. */
function milestone(id: string): Milestone {
  return {
    id,
    owner: 'owner',
    criteria: [criterion],
    steps: activities.map((activity) => ({
      activity,
      ...(activity === 'implementation'
        ? { checklist: [{ id: activity, criteria: [criterion.id], expected: 'Fix the file' }] }
        : { checklist: [], inapplicable: 'Outside this fixture' }),
    })),
  };
}

/** Bind one private fixture worktree and record all evidence to its real task journal. */
function nativeTask(t: TestContext, root: string): HostTask {
  const capture = {
    source: { root, remote: 'https://example.com/project.git' },
    project: { contractRegistry: 'registry.yaml' },
    contracts: [],
    components: {
      owner: {
        id: 'owner',
        owns: ['fixture.txt'],
        activities: {
          implementation: { profile: 'profile', operations: ['owner-tests'] },
        },
      },
    },
  } as unknown as Capture;
  const goal = 'Exercise failed steward check correction';
  const journal = new Coordination(root).admit(capture.source.remote, goal);
  assert('close' in journal);
  const task = new HostTask(
    { capture, common: root, executable: '', base: 'staging', fresh: true, storage: root },
    goal,
    journal,
  );
  task.worktree = root;
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return task;
}

/** Exercise the real Workflow and steward with observable model and command boundaries. */
class CheckTask {
  readonly calls: string[] = [];
  private readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-steward-check-'));
  private readonly file = join(this.root, 'fixture.txt');
  private readonly goalPlan: Plan = { focus, milestones: [milestone('original')] };
  private readonly task: HostTask;
  private failureLog = '';

  /** Make the check fail on the original bytes and pass only after the checked edit. */
  constructor(
    t: TestContext,
    private readonly correct: boolean,
  ) {
    this.task = nativeTask(t, this.root);
    writeFileSync(this.file, 'wrong');
    t.mock.method(this.task, 'check', async (id: string, _signal: AbortSignal, scope: unknown) => {
      const status = readFileSync(this.file, 'utf8') === 'corrected' ? 0 : 1;
      const log = this.task.store('fixture-check.log', `exit ${status}\n`);
      if (!this.failureLog) this.failureLog = log;
      this.calls.push(`check:${status}`);
      const check = {
        id,
        status,
        command: 'fixture',
        args: [],
        cwd: this.root,
        durationMs: 0,
        log,
      };
      this.task.note({ check, scope });
      return check;
    });
    t.mock.method(
      this.task,
      'activate',
      async (_agent: Agent, _selection: unknown, data: TaskContext) => this.proposal(data),
    );
  }

  /** Return a valid scoped edit on the correcting activation. */
  private proposal(data: TaskContext) {
    const correction = JSON.stringify(data.milestone).includes('"id":"correction"');
    this.calls.push(correction ? 'correction' : 'original');
    if (correction) {
      assert.match(JSON.stringify(data.assignment), /"status":1/);
      assert(JSON.stringify(data.assignment).includes(this.failureLog));
      const expected = createHash('sha256').update('wrong').digest('hex');
      const edits = this.correct ? [{ path: 'fixture.txt', expected, content: 'corrected' }] : [];
      return { kind: 'completed', edits, checks: [] };
    }
    const checks = this.calls.includes('check:0') ? [] : [{ id: 'owner-tests', expected: 'pass' }];
    return { kind: 'completed', edits: [], checks };
  }

  private readonly services: WorkflowServices = {
    execution: {
      admit: async () => this.task,
      assemble: async () => ({ digest: 'candidate', evidence: [] }),
    },
    direction: {
      plan: async () => ({ kind: 'plan', plan: this.goalPlan }),
      revise: async (_session, previous, feedback) => {
        this.calls.push('direction');
        assert.deepEqual(previous, this.goalPlan);
        assert.equal(feedback.kind, 'supplier');
        assert.equal(feedback.owner, 'owner');
        assert(feedback.evidence.includes(this.failureLog));
        return {
          kind: 'plan',
          plan: { focus, milestones: [milestone('correction'), ...this.goalPlan.milestones] },
        };
      },
    },
    agent: {
      execute: (session, selected, activity, signal) =>
        steward(agent, session, selected, activity, signal),
    },
    verification: {
      assess: async () => ({
        kind: 'accepted',
        candidate: 'candidate',
        criteria: [criterion.id],
        evidence: [],
      }),
    },
    delivery: {
      integrate: async () => {
        this.calls.push('delivery');
        return { kind: 'merged', commit: 'staging-merge', evidence: [] };
      },
    },
  };

  /** Run one invocation to its terminal outcome. */
  run() {
    return new Workflow(this.services).run(
      { directory: this.root, goal: this.task.goal },
      { progress() {} },
      new AbortController().signal,
    );
  }
}

test('a failing steward check reaches its owner and is rerun before the task delivers', async (t) => {
  const task = new CheckTask(t, true);
  assert.equal((await task.run()).kind, 'merged');
  assert.deepEqual(task.calls, [
    'original',
    'check:1',
    'direction',
    'correction',
    'check:0',
    'original',
    'delivery',
  ]);
});

test('a correction that still fails its required check blocks before resumption', async (t) => {
  const task = new CheckTask(t, false);
  const result = await task.run();
  assert.equal(result.kind, 'blocked');
  assert.match(result.reason, /owner-tests.*1/);
  assert.deepEqual(task.calls, ['original', 'check:1', 'direction', 'correction', 'check:1']);
});
