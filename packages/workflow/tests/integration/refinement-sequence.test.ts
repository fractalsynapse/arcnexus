import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { Architecture, Capture } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { Execution } from '../../../execution/src/index.js';
import { Workflow, type TaskObserver, type WorkflowServices } from '../../src/index.js';

export const suite = { owner: 'workflow', level: 'integration', tags: ['regression'] } as const;

type Refinement = (
  directory: string,
  rounds: number,
  observer: TaskObserver,
  signal: AbortSignal,
) => Promise<unknown>;

/** Create real Git and SQLite boundaries for the public workflow. */
function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'workflow-refinement-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = join(directory, 'project');
  mkdirSync(root);
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-b', 'staging');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  writeFileSync(join(root, 'baseline'), 'measured evidence\n');
  git('add', '.');
  git('commit', '-m', 'baseline');
  git('remote', 'add', 'origin', root);
  writeFileSync(
    join(root, '.git', 'bindings.yaml'),
    `schemaVersion: 1\ntools:\n  codex: ${process.execPath}\n`,
  );
  return authority(root, directory, git('rev-parse', 'HEAD'));
}

/** Capture two approved goals and construct the normal Execution service. */
function authority(root: string, directory: string, revision: string) {
  const bodies: Record<string, string> = {
    '.arc/goals/first.md': '---\npriority: 1\n---\nFirst goal\n',
    '.arc/goals/second.md': '---\npriority: 2\n---\nSecond goal\n',
    baseline: 'measured evidence\n',
  };
  const capture = {
    source: {
      root,
      revision,
      remote: 'https://example.invalid/project.git',
      paths: Object.keys(bodies),
      read: (path: string) => bodies[path],
    },
    project: {
      knowledgeRoot: '.arc',
      delivery: { baseBranch: 'staging', protectedBranch: 'main' },
      checks: { acceptance: ['fixture'] },
      bindings: '.git/bindings.yaml',
    },
  } as unknown as Capture;
  const architecture = { capture: () => capture } as unknown as Architecture;
  const storage = join(directory, 'state');
  const execution = new Execution(architecture, new Coordination(storage), storage);
  return { root, revision, capture, execution, bodies };
}

/** Give each measured goal an explicit evidence-backed assessment. */
function assessGoal(session: { goal: string }, calls: string[]) {
  calls.push(session.goal.trim());
  return {
    kind: 'satisfied',
    summary: 'The measured goal holds',
    evidence: [{ path: 'baseline', quote: 'measured evidence' }],
  };
}

/** Return explicit no-change and evidence-backed provider decisions. */
function providers(f: ReturnType<typeof fixture>, calls: string[]) {
  const { revision, capture, execution } = f;
  return {
    execution: {
      admit: execution.admit.bind(execution),
      round: execution.round.bind(execution),
      observeGoal: () => ({ revision, source: capture.source, recentChanges: [] }),
    },
    planner: {
      propose: async () => {
        calls.push('Plan');
        return { kind: 'planned', commit: revision, summary: 'No change', evidence: [] };
      },
    },
    architecture: {
      propose: async () => {
        calls.push('Architect');
        return { kind: 'no-change', summary: 'No change', evidence: [] };
      },
    },
    direction: { plan: async (session: { goal: string }) => assessGoal(session, calls) },
    agent: {},
    verification: {},
    delivery: {},
  } as unknown as WorkflowServices;
}

test('a completed invocation permits a fresh invocation with new assessments', async (t) => {
  const f = fixture(t);
  const calls: string[] = [];
  const workflow = new Workflow(providers(f, calls));
  const refine = Reflect.get(workflow, 'refine') as (
    directory: string,
    rounds: number,
    observer: TaskObserver,
    signal: AbortSignal,
  ) => Promise<unknown>;
  assert.equal(typeof refine, 'function', 'Workflow exposes the refinement boundary');
  const signal = new AbortController().signal;
  await refine.call(workflow, f.root, 1, { progress() {} }, signal);
  await refine.call(workflow, f.root, 1, { progress() {} }, signal);
  assert.deepEqual(calls, [
    'Plan',
    'Architect',
    'First goal',
    'Second goal',
    'Plan',
    'Architect',
    'First goal',
    'Second goal',
  ]);
});

test('an interrupted invocation refuses a changed round total before reassessment', async (t) => {
  const f = fixture(t);
  const calls: string[] = [];
  const services = providers(f, calls);
  const controller = new AbortController();
  assert.ok(services.planner);
  services.planner.propose = async () => {
    calls.push('Plan');
    controller.abort();
    controller.signal.throwIfAborted();
    throw new Error('Unreachable');
  };
  const workflow = new Workflow(services);
  const refine = Reflect.get(workflow, 'refine') as Refinement;
  assert.equal(typeof refine, 'function', 'Workflow exposes the refinement boundary');
  await refine.call(workflow, f.root, 2, { progress() {} }, controller.signal).catch(() => {});
  const before = [...calls];
  assert.deepEqual(before, ['Plan'], 'the original invocation reached its first phase');
  const changed = await refine.call(
    workflow,
    f.root,
    3,
    { progress() {} },
    new AbortController().signal,
  );
  assert.equal(Reflect.get(changed as object, 'kind'), 'invalid');
  assert.deepEqual(calls, before, 'a changed total must not restart assessment');
});

test('retrying the same total resumes the interrupted invocation', async (t) => {
  const f = fixture(t);
  const calls: string[] = [];
  const scenario = interruptProviders(f, calls, 'Architect');
  const workflow = new Workflow(scenario.services);
  const refine = Reflect.get(workflow, 'refine') as Refinement;
  assert.equal(typeof refine, 'function', 'Workflow exposes the refinement boundary');
  await refine
    .call(workflow, f.root, 2, { progress() {} }, scenario.controller.signal)
    .catch(() => {});
  assert.equal(scenario.interrupted(), true);
  await refine.call(workflow, f.root, 2, { progress() {} }, new AbortController().signal);
  assert.deepEqual(calls, [
    'Plan',
    'Architect',
    'Architect',
    'First goal',
    'Second goal',
    'Plan',
    'Architect',
    'First goal',
    'Second goal',
  ]);
});

test('a competing foreground task is refused while the refinement phase runs', async (t) => {
  const f = fixture(t);
  const services = providers(f, []);
  const signal = new AbortController().signal;
  assert.ok(services.planner);
  let competingKind: unknown;
  services.planner.propose = async () => {
    const competing = await f.execution.admit(
      { directory: f.root, goal: 'Competing task' },
      signal,
    );
    competingKind = Reflect.get(competing, 'kind');
    return { kind: 'planned', commit: f.revision, summary: 'No change', evidence: [] };
  };
  const workflow = new Workflow(services);
  const refine = Reflect.get(workflow, 'refine') as (
    directory: string,
    rounds: number,
    observer: TaskObserver,
    signal: AbortSignal,
  ) => Promise<unknown>;
  assert.equal(typeof refine, 'function', 'Workflow exposes the refinement boundary');
  await refine.call(workflow, f.root, 1, { progress() {} }, signal);
  assert.equal(competingKind, 'invalid');
});

/** Interrupt one selected assessment and record each visit. */
function interruptProviders(f: ReturnType<typeof fixture>, calls: string[], stop: string) {
  const services = providers(f, calls);
  const controller = new AbortController();
  let interrupted = false;
  const visit = (name: string) => {
    calls.push(name);
    if (name === stop && !interrupted) {
      interrupted = true;
      controller.abort();
      controller.signal.throwIfAborted();
    }
  };
  assert.ok(services.planner);
  services.planner.propose = async () => {
    visit('Plan');
    return { kind: 'planned', commit: f.revision, summary: 'No change', evidence: [] };
  };
  assert.ok(services.architecture);
  services.architecture.propose = async () => {
    visit('Architect');
    return { kind: 'no-change', summary: 'No change', evidence: [] };
  };
  services.direction.plan = async (session) => {
    visit(session.goal.trim());
    return assessGoal(session, []);
  };
  return { services, controller, interrupted: () => interrupted };
}

/** Exercise one interrupted position using the same durable state on retry. */
async function interruption(t: TestContext, stop: string) {
  const f = fixture(t);
  const calls: string[] = [];
  const scenario = interruptProviders(f, calls, stop);
  const workflow = new Workflow(scenario.services);
  const refine = Reflect.get(workflow, 'refine') as Refinement;
  assert.equal(typeof refine, 'function', 'Workflow exposes the refinement boundary');
  await refine
    .call(workflow, f.root, 1, { progress() {} }, scenario.controller.signal)
    .catch(() => {});
  assert.equal(scenario.interrupted(), true);
  await refine.call(workflow, f.root, 1, { progress() {} }, new AbortController().signal);
  const order = ['Plan', 'Architect', 'First goal', 'Second goal'];
  const index = order.indexOf(stop);
  assert.deepEqual(calls, [...order.slice(0, index + 1), ...order.slice(index)]);
}

test('interruption resumes the first unfinished phase or goal without repeating earlier work', async (t) => {
  for (const stop of ['Plan', 'Architect', 'First goal', 'Second goal']) {
    await t.test(stop, (child) => interruption(child, stop));
  }
});

const refreshedOrder = [
  'Plan',
  'Architect',
  'First goal',
  'Second goal',
  'Second goal',
  'Plan',
  'Architect',
  'First goal',
  'Updated goal',
];

test('an interrupted Run retains its captured goals and the next round captures changes', async (t) => {
  const f = fixture(t);
  const calls: string[] = [];
  const services = providers(f, calls);
  const controller = new AbortController();
  let interrupted = false;
  services.direction.plan = async (session) => {
    const goal = session.goal.trim();
    calls.push(goal);
    if (goal === 'Second goal' && !interrupted) {
      interrupted = true;
      f.bodies['.arc/goals/second.md'] = '---\npriority: 2\n---\nUpdated goal\n';
      controller.abort();
      controller.signal.throwIfAborted();
    }
    return assessGoal(session, []);
  };
  const workflow = new Workflow(services);
  const refine = Reflect.get(workflow, 'refine') as Refinement;
  assert.equal(typeof refine, 'function', 'Workflow exposes the refinement boundary');
  await refine.call(workflow, f.root, 2, { progress() {} }, controller.signal).catch(() => {});
  assert.equal(interrupted, true);
  await refine.call(workflow, f.root, 2, { progress() {} }, new AbortController().signal);
  assert.deepEqual(calls, refreshedOrder);
});

test('two refinement rounds assess Plan, Architect and every approved goal in order', async (t) => {
  const f = fixture(t);
  const calls: string[] = [];
  const workflow = new Workflow(providers(f, calls));
  const refine = Reflect.get(workflow, 'refine') as (
    directory: string,
    rounds: number,
    observer: TaskObserver,
    signal: AbortSignal,
  ) => Promise<unknown>;
  assert.equal(typeof refine, 'function', 'Workflow exposes the refinement boundary');
  await refine.call(workflow, f.root, 2, { progress() {} }, new AbortController().signal);
  assert.deepEqual(calls, [
    'Plan',
    'Architect',
    'First goal',
    'Second goal',
    'Plan',
    'Architect',
    'First goal',
    'Second goal',
  ]);
});
