import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
        owns: ['fixture.txt', 'earlier.txt'],
        activities: {
          implementation: { profile: 'profile', operations: ['owner-tests'] },
        },
      },
      other: { id: 'other', owns: ['other.txt'], activities: {} },
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
  t.mock.method(task, 'cleanup', () => {});
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
      assert.match(
        JSON.stringify(data.assignment),
        /read-only filesystem.*mapped checked-edit MCP tool/,
      );
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

test('a malformed steward reply is repaired in the same step before checked effects', async (t) => {
  const task = nativeTask(t, mkdtempSync(join(tmpdir(), 'arcnexus-steward-repair-')));
  const file = join(task.worktree!, 'fixture.txt');
  const replacement = { path: 'fixture.txt', expected: null, content: 'corrected' };
  const transcript = task.store('invalid-codex.jsonl', 'retained malformed reply');
  const replies = t.mock.method(
    task,
    'activate',
    async (_agent: Agent, _selection: unknown, context: TaskContext) => {
      assert.equal(existsSync(file), false);
      const repair = (context.assignment as { responseRepair?: string }).responseRepair;
      if (!repair) return { completed: { kind: 'completed', edits: [replacement], checks: [] } };
      assert.match(repair, /response\.kind/);
      assert(context.evidence?.includes(transcript));
      return { kind: 'completed', edits: [replacement], checks: [] };
    },
  );

  const outcome = await steward(
    agent,
    task,
    milestone('repair-format'),
    'implementation',
    new AbortController().signal,
  );
  assert.equal(outcome.kind, 'completed');
  assert.equal(replies.mock.callCount(), 2);
  assert.equal(readFileSync(file, 'utf8'), 'corrected');
  task.close();
});

test('a second malformed reply blocks the step and keeps both transcripts', async (t) => {
  const task = nativeTask(t, mkdtempSync(join(tmpdir(), 'arcnexus-steward-repair-')));
  const replies = t.mock.method(task, 'activate', async () => {
    task.store('codex.jsonl', 'retained malformed reply');
    return { kind: 'completed', edits: [], checks: [{ id: 'forbidden', expected: 'pass' }] };
  });
  const outcome = await steward(
    agent,
    task,
    milestone('repair-exhausted'),
    'implementation',
    new AbortController().signal,
  );
  assert.equal(outcome.kind, 'blocked');
  assert.match(outcome.reason, /response\.checks\[0\]\.id: forbidden is unavailable/);
  assert.equal(replies.mock.callCount(), 2);
  assert.equal(outcome.evidence.length, 2);
  task.close();
});

test('a refused ownership request returns the captured owner to the same steward', async (t) => {
  const task = nativeTask(t, mkdtempSync(join(tmpdir(), 'arcnexus-steward-ownership-')));
  const file = join(task.worktree!, 'other.txt');
  const edit = { path: 'other.txt', expected: null, content: 'forbidden' };
  const replies = t.mock.method(
    task,
    'activate',
    async (_agent: Agent, _selection: unknown, context: TaskContext) => {
      const diagnostic = (context.assignment as { responseRepair?: string }).responseRepair;
      assert.equal(existsSync(file), false);
      if (diagnostic) {
        assert.match(diagnostic, /other\.txt; captured owners: other/);
        return { kind: 'supplier', owner: 'other', milestone: 'repair', reason: 'Owns the file' };
      }
      return { kind: 'completed', edits: [edit], checks: [] };
    },
  );
  t.after(() => task.close());
  const outcome = await steward(
    agent,
    task,
    milestone('repair'),
    'implementation',
    AbortSignal.timeout(5000),
  );
  assert.equal(outcome.kind, 'supplier');
  assert.equal(outcome.owner, 'other');
  assert.equal(replies.mock.callCount(), 2);
});

/** Seed a completed supplier contribution through the real task journal. */
function recordSupplierAnswer(task: HostTask, answer: string) {
  task.record({
    plan: { focus, milestones: [milestone('supplier'), milestone('requester')] },
    supplier: {
      milestone: 'supplier',
      request: {
        kind: 'supplier',
        requester: 'requester',
        owner: 'other',
        milestone: 'supplier',
        reason: 'Confirm the interface',
        question: 'Which interface applies?',
        evidence: [],
      },
    },
  });
  task.record({
    activation: {
      milestone: 'supplier',
      owner: 'other',
      step: 'implementation',
      index: 2,
      outcome: { kind: 'completed', evidence: [], answer },
    },
  });
}

test('the requesting steward gets the complete recorded supplier answer', async (t) => {
  const task = nativeTask(t, mkdtempSync(join(tmpdir(), 'arcnexus-supplier-answer-')));
  t.after(() => task.close());
  const answer = '  Use the approved interface.\n\nKeep the captured revision.  ';
  recordSupplierAnswer(task, answer);
  t.mock.method(
    task,
    'activate',
    async (_agent: Agent, _selection: unknown, context: TaskContext) => {
      const { supplierAnswers } = context.assignment as Record<string, unknown>;
      assert.deepEqual(supplierAnswers, [
        {
          supplier: 'supplier',
          question: 'Which interface applies?',
          replies: [{ step: 'implementation', answer, evidence: [] }],
        },
      ]);
      return { kind: 'completed', edits: [], checks: [] };
    },
  );
  const outcome = await steward(
    agent,
    task,
    milestone('requester'),
    'implementation',
    AbortSignal.timeout(5000),
  );
  assert.equal(outcome.kind, 'completed');
});

test('the steward can substitute exact text without copying the rest of the file', async (t) => {
  const task = nativeTask(t, mkdtempSync(join(tmpdir(), 'arcnexus-steward-transform-')));
  const file = join(task.worktree!, 'fixture.txt');
  const original = 'prefix buggy suffix';
  writeFileSync(file, original);
  const expected = createHash('sha256').update(original).digest('hex');
  t.mock.method(task, 'activate', async () => ({
    kind: 'completed',
    edits: [
      {
        path: 'fixture.txt',
        expected,
        transform: { replace: { before: 'buggy', after: 'fixed' } },
      },
    ],
    checks: [],
  }));
  const activation = {
    step: milestone('exact-substitution'),
    signal: new AbortController().signal,
  };
  const outcome = await steward(agent, task, activation.step, 'implementation', activation.signal);
  assert.equal(outcome.kind, 'completed');
  assert.equal(readFileSync(file, 'utf8'), 'prefix fixed suffix');
  task.close();
});

/** Exercise repeated activations before the checked edit batch can change the source. */
class StaleEditScenario {
  /** Return a misspelled digest once, then use the actual digest in the diagnostic. */
  static async reply(root: string, assignment: TaskContext['assignment']) {
    assert.equal(readFileSync(join(root, 'fixture.txt'), 'utf8'), 'initial');
    assert(!existsSync(join(root, 'earlier.txt')));
    const hash = createHash('sha256').update('initial').digest('hex');
    const { responseRepair } = assignment as { responseRepair?: string };
    if (responseRepair) assert(responseRepair.includes(hash));
    return {
      kind: 'completed',
      edits: [
        { path: 'earlier.txt', expected: null, content: 'admitted' },
        {
          path: 'fixture.txt',
          expected: responseRepair ? hash : 'e'.repeat(64),
          content: 'repaired',
        },
      ],
      checks: [],
    };
  }
}

test('a stale digest is corrected without applying earlier edits in the rejected reply', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-steward-stale-digest-'));
  const task = nativeTask(t, root);
  const file = join(root, 'fixture.txt');
  writeFileSync(file, 'initial');
  const replies = t.mock.method(
    task,
    'activate',
    (_agent: Agent, _pick: unknown, context: TaskContext) =>
      StaleEditScenario.reply(root, context.assignment),
  );
  const outcome = await steward(
    agent,
    task,
    milestone('stale-edit'),
    'implementation',
    AbortSignal.timeout(2000),
  );
  assert.equal(outcome.kind, 'completed');
  assert.equal(replies.mock.callCount(), 2);
  assert.equal(readFileSync(file, 'utf8'), 'repaired');
  task.close();
});
