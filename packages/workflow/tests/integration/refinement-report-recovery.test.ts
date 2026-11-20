import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { Architecture, Capture } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { Execution, hostTask } from '../../../execution/src/index.js';
import {
  Workflow,
  type TaskObserver,
  type TaskSession,
  type WorkflowServices,
} from '../../src/index.js';

export const suite = { owner: 'workflow', level: 'integration', tags: ['regression'] } as const;

type Refine = (
  directory: string,
  rounds: number,
  observer: TaskObserver,
  signal: AbortSignal,
) => Promise<unknown>;
type State = ReturnType<typeof services>;
type RecoveryState = State & { calls: { value: number }; reopen: () => State };

/** Build a retained SQLite journal and Git project for a restart across service instances. */
function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'workflow-refinement-report-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = join(directory, 'project');
  mkdirSync(root);
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-b', 'staging');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  writeFileSync(join(root, 'baseline'), 'durable report evidence\n');
  git('add', '.');
  git('commit', '-m', 'baseline');
  git('remote', 'add', 'origin', root);
  writeFileSync(
    join(root, '.git', 'bindings.yaml'),
    `schemaVersion: 1\ntools:\n  codex: ${process.execPath}\n`,
  );
  const revision = git('rev-parse', 'HEAD');
  return { directory, root, revision, reopen: () => services(root, directory, revision) };
}

/** Reopen accepted project authority and application storage with fresh service objects. */
function services(root: string, directory: string, revision: string) {
  const bodies = {
    '.arc/goals/first.md': '---\npriority: 1\n---\nFirst goal\n',
    baseline: 'durable report evidence\n',
  };
  const capture = {
    source: {
      root,
      revision,
      remote: 'https://github.com/fixture/refinement-report.git',
      paths: Object.keys(bodies),
      read: (path: string) => bodies[path as keyof typeof bodies],
    },
    project: {
      knowledgeRoot: '.arc',
      delivery: { baseBranch: 'staging', protectedBranch: 'main' },
      checks: { acceptance: ['fixture'] },
      bindings: '.git/bindings.yaml',
    },
  } as unknown as Capture;
  const storage = join(directory, 'state');
  const execution = new Execution(
    { capture: () => capture } as unknown as Architecture,
    new Coordination(storage),
    storage,
  );
  return { revision, capture, execution };
}

/** Compose the same real admission and namespaced goal round after every service reopen. */
function workflowServices(state: State, planner: unknown): WorkflowServices {
  return {
    execution: {
      admit: state.execution.admit.bind(state.execution),
      round: state.execution.round.bind(state.execution),
      observeGoal: () => ({
        revision: state.revision,
        source: state.capture.source,
        recentChanges: [],
      }),
    },
    planner: planner as WorkflowServices['planner'],
    architecture: {
      propose: async () => ({
        kind: 'no-change',
        summary: 'Architect retained its finding',
        evidence: [],
      }),
    },
    direction: {
      plan: async () => ({
        kind: 'satisfied',
        summary: 'Captured goal outcome retained',
        evidence: [{ path: 'baseline', quote: 'durable report evidence' }],
      }),
    },
    agent: {},
    verification: {},
    delivery: {},
  } as unknown as WorkflowServices;
}

/** Retain a complete answer and explicit profile usage as originating child events. */
async function recordProviderEvidence(
  session: TaskSession,
  calls: { value: number },
  revision: string,
) {
  calls.value++;
  const answer = await session.ask?.('Retain this complete answer', new AbortController().signal);
  session.record({ phase: 'question', message: `Complete answer: ${answer}` });
  const task = hostTask(session);
  const activation = 'fixture-planner-activation';
  const usage = { input_tokens: 17, output_tokens: 5 };
  const source = task.store(
    'provider-turn.json',
    JSON.stringify({ type: 'turn.completed', usage }),
  );
  task.note({
    nativeStarted: {
      activation,
      profile: 'planner-fixture',
      model: 'fixture-model',
      reasoning: 'high',
    },
  });
  task.note({
    nativeEvent: { activation, kind: 'event', source, event: { type: 'turn.completed', usage } },
  });
  task.note({ nativeFinished: { activation, durationMs: 7 } });
  return {
    kind: 'planned' as const,
    commit: revision,
    summary: `Distinct Planner finding attempt ${calls.value}`,
    evidence: [],
  };
}

/** Return the controlled Planner that should run once before restart. */
function measuredPlanner(calls: { value: number }, revision: string) {
  return {
    propose: async (session: TaskSession) => recordProviderEvidence(session, calls, revision),
    apply: async () => ({ kind: 'completed' as const, evidence: [] }),
  };
}

/** Stop after the successful Planner child's terminal event has entered durable history. */
function interruptingObserver(): TaskObserver {
  return {
    progress() {},
    answer: async () => 'The complete answer is retained verbatim, including its full conclusion.',
    event(event) {
      const observation = Reflect.get(event, 'observation');
      const outcome =
        typeof observation === 'object' && observation !== null
          ? Reflect.get(observation, 'outcome')
          : undefined;
      if (typeof outcome === 'object' && outcome?.kind === 'planned')
        throw new Error('Interrupt after child terminal commit');
    },
  };
}

/** Run the first attempt until its committed child is interrupted before parent acknowledgment. */
async function interruptAfterChild(root: string, state: RecoveryState) {
  const workflow = new Workflow(
    workflowServices(state, measuredPlanner(state.calls, state.revision)),
  );
  const outcome = await (Reflect.get(workflow, 'refine') as Refine).call(
    workflow,
    root,
    1,
    interruptingObserver(),
    new AbortController().signal,
  );
  assert.equal(Reflect.get(outcome as object, 'kind'), 'failed');
}

/** Resume through freshly constructed Workflow, Execution and Coordination objects. */
async function resume(root: string, state: RecoveryState) {
  const planner = {
    propose: async () => {
      state.calls.value++;
      throw new Error('A successful child must not be assessed again');
    },
    apply: async () => ({ kind: 'completed' as const, evidence: [] }),
  };
  const workflow = new Workflow(workflowServices(state.reopen(), planner));
  const events: unknown[] = [];
  await (Reflect.get(workflow, 'refine') as Refine).call(
    workflow,
    root,
    1,
    { progress() {}, event: (event) => events.push(event) },
    new AbortController().signal,
  );
  return events;
}

/** Resolve the typed public completion event and its registered readable report. */
function completedReport(events: readonly unknown[]) {
  const event = events.find((item) => {
    const observation = Reflect.get(item as object, 'observation');
    return (
      typeof observation === 'object' && observation !== null && 'completedRound' in observation
    );
  });
  assert.ok(event);
  const completion = Reflect.get(
    Reflect.get(event as object, 'observation') as object,
    'completedRound',
  ) as {
    report: string;
    findings: readonly string[];
    measurements: readonly string[];
  };
  return { completion, report: readFileSync(completion.report, 'utf8') };
}

/** Check complete source references, no replay and round-local event-derived accounting. */
function assertRecovery(state: RecoveryState, result: ReturnType<typeof completedReport>) {
  const { completion, report } = result;
  assert.match(report, /Distinct Planner finding attempt 1/);
  assert.doesNotMatch(report, /Distinct Planner finding attempt 2/);
  assert.match(report, /The complete answer is retained verbatim, including its full conclusion\./);
  assert.match(report, /Reused completed child outcome for refine:/);
  assert.equal(state.calls.value, 1);
  assert.equal(new Set(completion.findings).size, completion.findings.length);
  assert.equal(new Set(completion.measurements).size, completion.measurements.length);
  assert.equal(completion.measurements.length, 3);
  assert.match(report, /"profile": "planner-fixture"/);
  assert.match(report, /"input_tokens": \{\n\s+"reported": 17/);
  assert.match(report, /"output_tokens": \{\n\s+"reported": 5/);
  assert.match(report, /"cost": \{\n\s+"estimate": null/);
}

test('reopened recovery reports complete origins and exact round profile usage without replay', async (t) => {
  const f = fixture(t);
  const calls = { value: 0 };
  const state = { ...f.reopen(), calls, reopen: f.reopen };
  await interruptAfterChild(f.root, state);
  const events = await resume(f.root, state);
  assertRecovery(state, completedReport(events));
});
