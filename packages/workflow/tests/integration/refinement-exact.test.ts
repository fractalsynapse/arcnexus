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
      remote: 'https://github.com/fixture/project.git',
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
  return { root, directory, revision, capture, execution, bodies };
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

/** Invoke the intended decimal-string public boundary without assuming its implementation type. */
function refine(
  workflow: Workflow,
  root: string,
  total: string | number,
  observer: TaskObserver,
  signal: AbortSignal,
) {
  const entry = Reflect.get(workflow, 'refine') as unknown as (
    directory: string,
    rounds: string | number,
    observer: TaskObserver,
    signal: AbortSignal,
  ) => Promise<unknown>;
  return entry.call(workflow, root, total, observer, signal);
}

/** Pause Planner at an observable phase so an enormous request remains unfinished. */
function pause(services: WorkflowServices, calls: string[]) {
  const controller = new AbortController();
  services.planner!.propose = async () => {
    calls.push('Plan');
    controller.abort();
    controller.signal.throwIfAborted();
    throw new Error('Unreachable');
  };
  return controller.signal;
}

/** Reopen the actual journal and distinguish the same and adjacent decimal requests. */
async function exactRecovery(t: TestContext, total: string) {
  const f = fixture(t);
  const calls: string[] = [];
  const services = providers(f, calls);
  const first = await refine(
    new Workflow(services),
    f.root,
    total,
    { progress() {} },
    pause(services, calls),
  );
  assert.deepEqual(calls, ['Plan'], 'the large request reaches the first assessment');
  assert.notEqual(Reflect.get(first as object, 'kind'), 'invalid');
  const reopened = authority(f.root, f.directory, f.revision);
  const retryCalls: string[] = [];
  const retry = providers(reopened, retryCalls);
  const resumed = await refine(
    new Workflow(retry),
    f.root,
    '00' + total,
    { progress() {} },
    pause(retry, retryCalls),
  );
  assert.notEqual(Reflect.get(resumed as object, 'kind'), 'invalid');
  assert.deepEqual(retryCalls, ['Plan']);
  await assertChangedTotal(f.root, total, retry, retryCalls);
}

/** Reject a different requested total without entering another assessment. */
async function assertChangedTotal(
  root: string,
  total: string,
  retry: WorkflowServices,
  retryCalls: string[],
) {
  const refused = await refine(
    new Workflow(retry),
    root,
    (BigInt(total) + 1n).toString(),
    { progress() {} },
    new AbortController().signal,
  );
  assert.equal(Reflect.get(refused as object, 'kind'), 'invalid');
  assert.deepEqual(retryCalls, ['Plan'], 'a different total does not reassess');
}

test('exact large totals survive interruption and reject adjacent requests after reopening', async (t) => {
  for (const total of ['9007199254740993', '1' + '0'.repeat(400)])
    await t.test(total, (child) => exactRecovery(child, total));
});

/** Collect both progress and durable event envelopes exposed by the observer. */
function phaseObserver(events: string[]): TaskObserver {
  return {
    progress(value) {
      events.push(value.message);
    },
    event(event) {
      const observation = Reflect.get(event, 'observation');
      if (typeof observation === 'object' && observation !== null && 'refinement' in observation)
        events.push('event:' + JSON.stringify(Reflect.get(observation, 'refinement')));
    },
  };
}

/** Require a human and structured observation for each current phase. */
function assertPhases(events: string[]) {
  for (const round of ['1', '2']) {
    for (const phase of ['Plan', 'Architect', 'Run']) {
      assert.ok(
        events.some((value) => value.includes(`Refinement round ${round}/2 · ${phase}`)),
        `progress for ${round} ${phase}`,
      );
      assert.ok(
        events.some(
          (value) =>
            value.startsWith('event:') &&
            value.includes(`"round":"${round}"`) &&
            value.includes(`"phase":"${phase}"`),
        ),
        `event for ${round} ${phase}`,
      );
    }
  }
}

test('uninterrupted rounds announce each phase before its assessment', async (t) => {
  const f = fixture(t);
  const calls: string[] = [];
  const events: string[] = [];
  await refine(
    new Workflow(providers(f, calls)),
    f.root,
    2,
    phaseObserver(events),
    new AbortController().signal,
  );
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
  assertPhases(events);
});
