import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Context } from 'cordis';
import { agentPlugin } from '../../../../packages/agent/src/index.js';
import { architecturePlugin } from '../../../../packages/architecture/src/index.js';
import { commandsPlugin } from '../../../../packages/commands/src/index.js';
import { coordinationPlugin } from '../../../../packages/coordination/src/index.js';
import { activities, type Milestone, type Plan } from '../../../../packages/direction/src/index.js';
import {
  workflowPlugin,
  type TaskSession,
  type WorkflowServices,
} from '../../../../packages/workflow/src/index.js';
import { projectFixture } from '../fixtures/project.js';

export const suite = { owner: 'cli-app', level: 'integration', tags: ['regression'] } as const;

const cli = fileURLToPath(new URL('../../src/index.js', import.meta.url));

test('task plan validates explicit input before admission and does not fall back to task run', () => {
  const cli = fileURLToPath(new URL('../../src/index.js', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'task', 'plan', ' '], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage: arcnexus task plan/);
});

test('the recommendation flag accepts one optional focus and refuses invalid operands before admission', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'arcnexus-plan-args-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [cli, 'task', 'plan', '--recommend-objectives', ...args], {
      encoding: 'utf8',
      cwd,
    });
  for (const args of [[' '], ['a focus', 'extra']]) {
    const result = run(...args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage: arcnexus task plan --recommend-objectives/);
  }
  const decision = run('Focus on project documentation');
  assert.equal(decision.status, 2);
  assert.match(decision.stderr, /Cannot read Git project/);
});

test('GW-2: task run validates the goal before task admission', () => {
  for (const args of [[''], ['goal', 'extra']]) {
    const result = spawnSync(process.execPath, [cli, 'task', 'run', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Usage: arcnexus task run/);
  }
});

const criterion = { id: 'covers-goal', description: 'The requested behavior works' };
const focus = {
  purpose: 'Deliver the goal',
  objectives: ['Demonstrate success'],
  constraints: ['Use checked edits'],
};
const planDiagnostic = 'plan.milestones[0].steps[0].inapplicable: expected string, received object';
const findings = [
  {
    criterion: criterion.id,
    owner: 'work',
    reason: 'A regression is still present',
    evidence: ['check:regression'],
  },
];

/** Build five ordered Steps with explicit reasons for inactive work. */
function milestone(id: string): Milestone {
  return {
    id,
    owner: 'work',
    criteria: [criterion],
    steps: activities.map((activity) => ({
      activity,
      ...(activity === 'testing' || activity === 'release'
        ? { checklist: [{ id: activity, criteria: [criterion.id], expected: 'Observe evidence' }] }
        : { checklist: [], inapplicable: 'This fixture exercises the testing activity' }),
    })),
  };
}

/** Compose the real SDK and Workflow with isolated, observable task services. */
async function mountedWorkflow(
  t: TestContext,
  rejectRevision = false,
  malformed?: 'once' | 'always',
) {
  const root = projectFixture();
  const storage = mkdtempSync(join(tmpdir(), 'arcnexus-tasks-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  t.after(() => rmSync(storage, { recursive: true, force: true }));
  const context = new Context();
  await context.use(architecturePlugin);
  await context.use(agentPlugin);
  await context.use(coordinationPlugin(storage));
  const fixture = new FixtureServices(context, root, rejectRevision, malformed);
  await context.use(workflowPlugin(fixture));
  await context.use(commandsPlugin);
  return { calls: fixture.calls, events: fixture.events, context, root };
}

/** Supply isolated host adapters and validate the scoped Agent calls. */
class FixtureServices implements WorkflowServices {
  readonly calls: string[] = [];
  readonly events: unknown[] = [];
  private readonly initial: Plan = { focus, milestones: [milestone('initial')] };
  private last = 'none';

  /** Bind the fixture workspace and optionally model an invalid correction. */
  constructor(
    private readonly context: Context,
    private readonly root: string,
    private readonly rejectRevision: boolean,
    private readonly malformed?: 'once' | 'always',
  ) {}

  readonly execution: WorkflowServices['execution'] = {
    admit: async (input) => {
      assert.equal(input.directory, this.root);
      const capture = this.context.architecture.capture(this.root);
      const journal = this.context.coordination.admit(capture.source.remote, input.goal);
      if ('activeGoal' in journal) {
        return { kind: 'invalid', reason: `Active goal: ${journal.activeGoal}`, evidence: [] };
      }
      return {
        capture,
        goal: input.goal,
        record: (event) => journal.record(event),
        finish: (outcome) => journal.finish(outcome),
        close: () => {
          this.events.push(...journal.events());
          journal.close();
          this.calls.push('close');
        },
      };
    },
    assemble: async () => {
      this.calls.push(`assemble:${this.last}`);
      return { digest: this.last, evidence: [`candidate:${this.last}`] };
    },
  };

  readonly direction: WorkflowServices['direction'] = {
    plan: (session, signal) =>
      this.activate(session, 'director', 'director', 'planning', signal, () => {
        this.calls.push('director');
        return { kind: 'plan', plan: this.proposal(Boolean(this.malformed)) };
      }),
    revise: (session, original, feedback, signal) =>
      this.activate(session, 'director', 'director', 'planning', signal, () => {
        if (!original) {
          this.calls.push('director:repair');
          assert.deepEqual(feedback, { kind: 'plan-repair', diagnostic: planDiagnostic });
          return { kind: 'plan', plan: this.proposal(this.malformed === 'always') };
        }
        this.calls.push('director:revise');
        assert.deepEqual(original, this.initial);
        const rejection = { kind: 'rejection', findings };
        if (feedback.kind === 'plan-repair') {
          assert.deepEqual(feedback, {
            kind: 'plan-repair',
            diagnostic: 'The Director did not schedule a correction for covers-goal',
            original: rejection,
          });
        } else {
          assert.deepEqual(feedback, rejection);
        }
        const plan = this.rejectRevision
          ? this.initial
          : { focus, milestones: [...this.initial.milestones, milestone('correction')] };
        return { kind: 'plan', plan };
      }),
  };

  /** Reproduce a JSON response that violates the inactive Step field type. */
  private proposal(malformed: boolean) {
    if (!malformed) return this.initial;
    const initial = milestone('initial');
    const steps = initial.steps.map((step, index) =>
      index === 0 ? { ...step, inapplicable: { reason: 'Fixture inactive step' } } : step,
    );
    return { focus, milestones: [{ ...initial, steps }] };
  }

  readonly agent: WorkflowServices['agent'] = {
    execute: (session, selected, activity, signal) =>
      this.activate(session, 'steward', selected.owner, activity, signal, () => {
        this.calls.push(`steward:${selected.id}/${activity}`);
        this.last = selected.id;
        return { kind: 'completed', evidence: [`activity:${this.last}`] };
      }),
  };

  readonly verification: WorkflowServices['verification'] = {
    assess: (session, _plan, candidate, signal) =>
      this.activate(session, 'reviewer', 'reviewer', 'assessment', signal, () => {
        this.calls.push(`reviewer:${candidate.digest}`);
        return candidate.digest === 'initial'
          ? { kind: 'rejected', candidate: candidate.digest, findings }
          : {
              kind: 'accepted',
              candidate: candidate.digest,
              criteria: [criterion.id],
              evidence: ['review:accepted'],
            };
      }),
  };

  readonly delivery: WorkflowServices['delivery'] = {
    integrate: async (_session, candidate, verdict) => {
      assert.equal(candidate.digest, 'correction');
      assert.equal(verdict.candidate, candidate.digest);
      this.calls.push('delivery');
      return { kind: 'merged', commit: 'staging-merge', evidence: ['delivery:merge'] };
    },
  };

  /** Route all three fixture actors through the production request builder. */
  private activate<T>(
    session: TaskSession,
    actor: string,
    component: string,
    activity: string,
    signal: AbortSignal,
    respond: () => T,
  ): Promise<T> {
    const task = {
      assignment: 'Fixture assignment',
      goal: session.goal,
      milestone: this.last,
      acceptance: [criterion],
      evidence: [],
      worktree: this.root,
    };
    return this.context.agent.activate(
      { capture: session.capture, selection: { component, activity }, task },
      async (view) => {
        assert.equal(view.actor, actor);
        assert.match(view.request.input, /Goal: Fix the fixture/);
        return respond();
      },
      signal,
    );
  }
}

test('CMD-1, WFL-1 and WFL-2: rejected work returns to Direction before staging delivery', async (t) => {
  const { context, root, calls, events } = await mountedWorkflow(t);
  const observer = { progress() {} };
  const result = await context.commands.runTask(
    { directory: root, goal: 'Fix the fixture' },
    observer,
    new AbortController().signal,
  );
  assert.deepEqual(calls, [
    'director',
    'steward:initial/testing',
    'assemble:initial',
    'reviewer:initial',
    'director:revise',
    'steward:correction/testing',
    'assemble:correction',
    'reviewer:correction',
    'delivery',
    'close',
  ]);
  assert.deepEqual(events.at(-1), { outcome: result });
  assert.deepEqual(result, {
    kind: 'merged',
    commit: 'staging-merge',
    evidence: ['delivery:merge'],
  });
});

test('an invalid Director plan is repaired in one task before any steward or delivery', async (t) => {
  const { context, root, calls, events } = await mountedWorkflow(t, false, 'once');
  const result = await context.commands.runTask(
    { directory: root, goal: 'Fix the fixture' },
    { progress() {} },
    new AbortController().signal,
  );
  assert.equal(result.kind, 'merged');
  assert.deepEqual(calls.slice(0, 3), ['director', 'director:repair', 'steward:initial/testing']);
  assert.equal(calls.filter((call) => call === 'delivery').length, 1);
  assert(
    events.some(
      (event) =>
        JSON.stringify(event) ===
        JSON.stringify({ feedback: { kind: 'plan-repair', diagnostic: planDiagnostic } }),
    ),
  );
  assert.deepEqual(events.at(-1), { outcome: result });
});

test('an unchanged invalid Director plan holds with its diagnostic before activating a steward', async (t) => {
  const { context, root, calls } = await mountedWorkflow(t, false, 'always');
  const result = await context.commands.runTask(
    { directory: root, goal: 'Fix the fixture' },
    { progress() {} },
    new AbortController().signal,
  );
  assert.equal(result.kind, 'blocked');
  assert.equal(
    result.reason,
    `Director repeated an unchanged validation finding: ${planDiagnostic}`,
  );
  assert.deepEqual(calls, ['director', 'director:repair', 'close']);
});

test('WFL-2: a revision must schedule work against every rejected criterion', async (t) => {
  const { context, root, calls, events } = await mountedWorkflow(t, true);
  const result = await context.commands.runTask(
    { directory: root, goal: 'Fix the fixture' },
    { progress() {} },
    new AbortController().signal,
  );
  assert.equal(result.kind, 'blocked');
  assert.match(result.reason, /did not schedule a correction for covers-goal/);
  assert(!calls.includes('delivery'));
  assert.deepEqual(events.at(-1), { outcome: result });
});

test('WFL-3: cancellation retains the terminal result and does not reach review', async (t) => {
  const { context, root, calls, events } = await mountedWorkflow(t);
  const controller = new AbortController();
  const observer = {
    progress() {
      controller.abort(new Error('operator cancelled'));
    },
  };
  const result = await context.commands.runTask(
    { directory: root, goal: 'Fix the fixture' },
    observer,
    controller.signal,
  );
  assert.equal(result.kind, 'cancelled');
  assert(!calls.includes('delivery'));
  assert.deepEqual(events.at(-1), { outcome: result });
  assert.equal(calls.at(-1), 'close');
});

test('WFL-3 and CO-2: a second goal is refused while the SQLite lane is held', async (t) => {
  const { context, root, calls } = await mountedWorkflow(t);
  const remote = context.architecture.capture(root).source.remote;
  const existing = context.coordination.admit(remote, 'Existing goal');
  assert('close' in existing);
  t.after(() => existing.close());

  const result = await context.commands.runTask(
    { directory: root, goal: 'Second goal' },
    { progress() {} },
    new AbortController().signal,
  );
  assert.deepEqual(result, { kind: 'invalid', reason: 'Active goal: Existing goal', evidence: [] });
  assert.deepEqual(existing.events(), []);
  assert.deepEqual(calls, []);
});
