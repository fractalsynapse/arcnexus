import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { Agent } from '../../../agent/src/index.js';
import type { Architecture, Capture, TaskContext } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { Execution, HostTask } from '../../../execution/src/index.js';
import { Planner } from '../../../planner/src/index.js';
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
function refine(workflow: Workflow, root: string, total: string, observer: TaskObserver, signal: AbortSignal) {
  const entry = Reflect.get(workflow, 'refine') as (
    directory: string, rounds: string, observer: TaskObserver, signal: AbortSignal,
  ) => Promise<unknown>;
  return entry.call(workflow, root, total, observer, signal);
}

test('exact large totals survive interruption and reject adjacent requests after reopening', async (t) => {
  for (const total of ['9007199254740993', '1' + '0'.repeat(400)]) {
    await t.test(total, async (child) => {
      const f = fixture(child);
      const calls: string[] = [];
      const services = providers(f, calls);
      const controller = new AbortController();
      services.planner!.propose = async () => {
        calls.push('Plan');
        controller.abort();
        controller.signal.throwIfAborted();
        throw new Error('Unreachable');
      };
      const first = await refine(new Workflow(services), f.root, total, { progress() {} }, controller.signal);
      assert.deepEqual(calls, ['Plan'], 'the large request reaches the first assessment');
      assert.notEqual(Reflect.get(first as object, 'kind'), 'invalid');
      const reopened = authority(f.root, f.directory, f.revision);
      const retryCalls: string[] = [];
      const retry = providers(reopened, retryCalls);
      const next = new AbortController();
      retry.planner!.propose = async () => {
        retryCalls.push('Plan resumed');
        next.abort();
        next.signal.throwIfAborted();
        throw new Error('Unreachable');
      };
      const resumed = await refine(new Workflow(retry), f.root, '00' + total, { progress() {} }, next.signal);
      assert.notEqual(Reflect.get(resumed as object, 'kind'), 'invalid');
      assert.deepEqual(retryCalls, ['Plan resumed']);
      const changed = (BigInt(total) + 1n).toString();
      const refused = await refine(new Workflow(retry), f.root, changed, { progress() {} }, new AbortController().signal);
      assert.equal(Reflect.get(refused as object, 'kind'), 'invalid');
      assert.deepEqual(retryCalls, ['Plan resumed'], 'a different total does not reassess');
    });
  }
});

test('uninterrupted rounds announce each phase before its assessment', async (t) => {
  const f = fixture(t);
  const calls: string[] = [];
  const events: string[] = [];
  const services = providers(f, calls);
  const observer: TaskObserver = {
    progress(value) { events.push(value.message); },
    event(event) {
      const observation = Reflect.get(event, 'observation');
      if (typeof observation === 'object' && observation !== null && 'refinement' in observation) {
        const position = Reflect.get(observation, 'refinement');
        events.push('event:' + JSON.stringify(position));
      }
    },
  };
  await refine(new Workflow(services), f.root, '2', observer, new AbortController().signal);
  assert.deepEqual(calls, ['Plan', 'Architect', 'First goal', 'Second goal', 'Plan', 'Architect', 'First goal', 'Second goal']);
  for (const round of ['1', '2']) {
    for (const phase of ['Plan', 'Architect', 'Run']) {
      assert.ok(events.some((value) => value.includes(`Refinement round ${round}/2 · ${phase}`)), `progress for ${round} ${phase}`);
      assert.ok(events.some((value) => value.startsWith('event:') && value.includes(`"round":"${round}"`) && value.includes(`"phase":"${phase}"`)), `event for ${round} ${phase}`);
    }
  }
});
