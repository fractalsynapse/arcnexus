import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Agent } from '../../../agent/src/index.js';
import { Architecture, type TaskContext } from '../../../architecture/src/index.js';
import { activities, type Milestone, type Plan } from '../../../direction/src/index.js';
import { Workflow, type WorkflowServices } from '../../../workflow/src/index.js';
import { checkFailureSignature } from '../../src/steward-check.js';
import { type HostTask, steward } from '../../src/index.js';
import { StewardFixture } from '../fixtures/steward.js';

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
    private readonly correct: boolean | 'progress',
  ) {
    this.task = new StewardFixture(t, this.root).task;
    writeFileSync(this.file, 'wrong');
    t.mock.method(this.task, 'check', async (id: string, _signal: AbortSignal, scope: unknown) =>
      this.check(id, scope),
    );
    t.mock.method(
      this.task,
      'activate',
      async (_agent: Agent, _selection: unknown, data: TaskContext) => this.proposal(data),
    );
  }

  /** Retain the actual failing stage and the exact command observation. */
  private async check(id: string, scope: unknown) {
    const status = readFileSync(this.file, 'utf8') === 'corrected' ? 0 : 1;
    const stage = readFileSync(this.file, 'utf8');
    const diagnostic =
      stage === 'compiled' ? 'not ok 3 - Reviewer assertion' : 'error TS1005: Expected token';
    const log = this.task.store('fixture-check.log', status ? diagnostic : 'passed');
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
  }

  /** Return a valid scoped edit on the correcting activation. */
  private proposal(data: TaskContext) {
    const id = (data.milestone as { id: string }).id;
    const correction = Boolean((data.assignment as { failedCheck?: unknown }).failedCheck);
    this.calls.push(correction ? id : 'original');
    if (correction) {
      assert.match(
        JSON.stringify(data.assignment),
        /read-only filesystem.*checked-edit/,
      );
      assert.match(JSON.stringify(data.assignment), /"status":1/);
      assert(data.evidence?.includes(this.failureLog));
      const current = readFileSync(this.file, 'utf8');
      const expected = createHash('sha256').update(current).digest('hex');
      const content = this.correct === 'progress' && current === 'wrong' ? 'compiled' : 'corrected';
      const edits = this.correct ? [{ path: 'fixture.txt', expected, content }] : [];
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
        assert(previous);
        assert.equal(feedback.kind, 'supplier');
        assert.equal(feedback.owner, 'owner');
        assert(feedback.failedCheck);
        if (this.calls.filter((call) => call === 'direction').length === 2)
          assert.match(readFileSync(feedback.failedCheck.log, 'utf8'), /Reviewer assertion/);
        return {
          kind: 'plan',
          plan: {
            focus,
            milestones: [
              milestone(previous.milestones.length === 1 ? 'correction' : 'correction-reviewer'),
              ...previous.milestones,
            ],
          },
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

test('a local steward check repair delivers within the original milestone without Direction', async (t) => {
  const task = new CheckTask(t, true);
  assert.equal((await task.run()).kind, 'merged');
  assert.deepEqual(task.calls, ['original', 'check:1', 'original', 'check:0', 'delivery']);
});

test('an unchanged local check failure holds without another Director call', async (t) => {
  const task = new CheckTask(t, false);
  const result = await task.run();
  assert.equal(result.kind, 'blocked');
  assert.match(result.reason, /owner-tests.*1/);
  assert.deepEqual(task.calls, ['original', 'check:1', 'original', 'check:1']);
});

test('a malformed steward reply is repaired in the same step before checked effects', async (t) => {
  const task = new StewardFixture(t, mkdtempSync(join(tmpdir(), 'arcnexus-steward-repair-'))).task;
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
  const task = new StewardFixture(t, mkdtempSync(join(tmpdir(), 'arcnexus-steward-repair-'))).task;
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
  const task = new StewardFixture(t, mkdtempSync(join(tmpdir(), 'arcnexus-steward-ownership-')))
    .task;
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
  const task = new StewardFixture(t, mkdtempSync(join(tmpdir(), 'arcnexus-supplier-answer-'))).task;
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
  const task = new StewardFixture(t, mkdtempSync(join(tmpdir(), 'arcnexus-steward-transform-')))
    .task;
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
  const task = new StewardFixture(t, root).task;
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

test('distinct local check failures repair in the original milestone without Direction', async (t) => {
  const task = new CheckTask(t, 'progress');
  const result = await task.run();
  assert.equal(result.kind, 'merged', JSON.stringify(result));
  assert.deepEqual(task.calls, [
    'original',
    'check:1',
    'original',
    'check:1',
    'original',
    'check:0',
    'delivery',
  ]);
});

test('failure identity ignores process paths and TAP numbering while retaining the actual diagnostic', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-check-diagnostic-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const first = join(root, 'first.log');
  const repeat = join(root, 'repeat.log');
  const fresh = join(root, 'fresh.log');
  writeFileSync(first, 'not ok 3 - Reviewer parity\n  duration_ms: 12\n  error: assertion failed');
  writeFileSync(repeat, 'not ok 8 - Reviewer parity\n  duration_ms: 35\n  error: assertion failed');
  writeFileSync(fresh, '/state/runs/5/worktree/source.ts(12,3): error TS1005: Expected token');
  assert.equal(checkFailureSignature(first), checkFailureSignature(repeat));
  assert.notEqual(checkFailureSignature(first), checkFailureSignature(fresh));
  writeFileSync(repeat, '/state/runs/9/worktree/source.ts(21,3): error TS1005: Expected token');
  assert.equal(checkFailureSignature(fresh), checkFailureSignature(repeat));
  writeFileSync(
    first,
    'not ok 3 - Reviewer parity\n  error: |-\n    assert(activity?.[1])\n  code: ERR_ASSERTION',
  );
  writeFileSync(
    repeat,
    'not ok 8 - Reviewer parity\n  error: |-\n    assert(actual.cwd)\n  code: ERR_ASSERTION',
  );
  assert.notEqual(checkFailureSignature(first), checkFailureSignature(repeat));
});
