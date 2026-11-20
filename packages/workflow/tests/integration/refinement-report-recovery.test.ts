import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Architecture, Capture } from '../../../architecture/src/index.js';
import { RefinementPlanner } from '../fixtures/refinement-planner.js';
import { assertAccounting, assertOrigins, history } from '../fixtures/refinement-history.js';
import type { CompletedRefinementRound } from '../../src/index.js';
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
type RecoveryState = State & {
  calls: { value: number };
  reopen: () => State;
  failFirstPlanner?: boolean;
};

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
    components: { planner: { activities: { planning: { profile: 'planner-fixture' } } } },
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

/** Return the successful phase fixtures used after Planner recovery. */
function successfulPhases() {
  return {
    architecture: {
      propose: async () => ({
        kind: 'no-change' as const,
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
  };
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
    ...successfulPhases(),
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
  recordUsage(hostTask(session));
  return {
    kind: 'planned' as const,
    commit: revision,
    summary: `Distinct Planner finding attempt ${calls.value}`,
    evidence: [],
  };
}

/** Retain controlled provider attribution and usage in the real child journal. */
function recordUsage(task: ReturnType<typeof hostTask>) {
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
    2,
    interruptingObserver(),
    new AbortController().signal,
  );
  assert.equal(Reflect.get(outcome as object, 'kind'), 'failed');
}

/** Resume the interrupted first round, then finish a distinct second round after reopening. */
async function resume(root: string, state: RecoveryState) {
  const planner = {
    propose: async (session: TaskSession) =>
      recordProviderEvidence(session, state.calls, state.revision),
    apply: async () => ({ kind: 'completed' as const, evidence: [] }),
  };
  const workflow = new Workflow(workflowServices(state.reopen(), planner));
  const events: unknown[] = [];
  await (Reflect.get(workflow, 'refine') as Refine).call(
    workflow,
    root,
    2,
    {
      progress() {},
      answer: async () => 'The resumed complete answer for attempt 2.',
      event: (event) => events.push(event),
    },
    new AbortController().signal,
  );
  return events;
}

/** Resolve every typed completion event to its registered readable report. */
function completedReports(events: readonly unknown[]) {
  return events.flatMap((event) => {
    const observation = Reflect.get(event as object, 'observation');
    if (
      typeof observation !== 'object' ||
      observation === null ||
      !('completedRound' in observation)
    )
      return [];
    const completion = Reflect.get(observation, 'completedRound') as {
      report: string;
      findings: readonly string[];
      measurements: readonly string[];
      round: number;
    };
    return [{ completion, report: readFileSync(completion.report, 'utf8') }];
  });
}

/** Check one round's complete origins, deduplicated references and profile accounting. */
function assertRound(
  result: ReturnType<typeof completedReports>[number],
  attempt: number,
  reused: boolean,
) {
  const { completion, report } = result;
  assert.match(report, new RegExp('Distinct Planner finding attempt ' + attempt));
  assert.doesNotMatch(
    report,
    new RegExp('Distinct Planner finding attempt ' + (attempt === 1 ? 2 : 1)),
  );
  if (attempt === 1)
    assert.match(
      report,
      /The complete answer is retained verbatim, including its full conclusion\./,
    );
  else assert.match(report, /The resumed complete answer for attempt 2\./);
  if (reused) assert.match(report, /Reused completed child outcome for refine:/);
  else assert.doesNotMatch(report, /Reused completed child outcome for refine:/);
  assert.equal(new Set(completion.findings).size, completion.findings.length);
  assert.equal(new Set(completion.measurements).size, completion.measurements.length);
  assert.equal(completion.measurements.length, 3, "only this round's provider stream is measured");
  assert.match(report, /"profile": "planner-fixture"/);
  assert.match(report, /"input_tokens": \{\n\s+"reported": 17/);
  assert.match(report, /"output_tokens": \{\n\s+"reported": 5/);
  assert.match(report, /"cost": \{\n\s+"estimate": null/);
}

test('reopened recovery reports every origin and exact round profile usage without replay', async (t) => {
  const f = fixture(t);
  const calls = { value: 0 };
  const state = { ...f.reopen(), calls, reopen: f.reopen };
  await interruptAfterChild(f.root, state);
  const events = await resume(f.root, state);
  const rounds = completedReports(events);
  assert.equal(rounds.length, 2);
  assert.equal(rounds[0]!.completion.round, 1);
  assert.equal(rounds[1]!.completion.round, 2);
  assertRound(rounds[0]!, 1, true);
  assertRound(rounds[1]!, 2, false);
  assert.equal(calls.value, 2, 'the recovered first child is not repeated; round two is assessed');
});

/** Bind a real executable fixture outside source while keeping Git admission clean. */
function installProvider(root: string) {
  const executable = join(root, '.git', 'refinement-provider.mjs');
  copyFileSync(
    fileURLToPath(new URL('../fixtures/refinement-provider.js', import.meta.url)),
    executable,
  );
  chmodSync(executable, 0o700);
  writeFileSync(
    join(root, '.git', 'bindings.yaml'),
    'schemaVersion: 1\ntools:\n  codex: ' + executable + '\n',
  );
}

/** Track actual child identities without deriving the report's scopes or timeline paths. */
function continuationServices(state: State, planner: RefinementPlanner) {
  const services = workflowServices(state, planner);
  const phases = successfulPhases();
  services.architecture!.propose = async (session) => {
    planner.observe(session);
    return phases.architecture.propose();
  };
  services.direction.plan = async (session) => {
    planner.observe(session);
    return phases.direction.plan();
  };
  return services;
}

/** Cancel only after the native pipe has delivered the first attempt's reported usage. */
function unfinishedObserver(controller: AbortController): TaskObserver {
  return {
    progress() {},
    answer: async () => 'Original complete answer.\nEvery detail and the final conclusion survive.',
    event(event) {
      const observation = Reflect.get(event, 'observation') as {
        nativeEvent?: { event?: { type?: string } };
      };
      if (observation.nativeEvent?.event?.type === 'turn.completed') controller.abort();
    },
  };
}

/** Retry through freshly constructed Workflow, Execution and Coordination against retained state. */
async function continueUnfinished(f: ReturnType<typeof fixture>, planner: RefinementPlanner) {
  const workflow = new Workflow(continuationServices(f.reopen(), planner));
  const rounds: CompletedRefinementRound[] = [];
  const outcome = await workflow.refine(
    f.root,
    2,
    {
      progress() {},
      answer: async () => 'Second-round complete answer.\nA different final conclusion.',
      event(event) {
        const observation = Reflect.get(event, 'observation') as {
          completedRound?: CompletedRefinementRound;
        };
        if (observation.completedRound) rounds.push(observation.completedRound);
      },
    },
    new AbortController().signal,
  );
  assert.equal(outcome.kind, 'planned');
  return rounds;
}

/** Require both attempts, all terminal outcomes and exact per-round retained accounting. */
function assertContinuation(
  f: ReturnType<typeof fixture>,
  planner: RefinementPlanner,
  rounds: CompletedRefinementRound[],
) {
  assert.deepEqual(
    rounds.map(({ round }) => round),
    [1, 2],
  );
  const origins = rounds.map(({ round }) =>
    history(
      join(f.directory, 'state'),
      f.reopen().capture.source.remote,
      planner.tasks.get(round)!,
    ),
  );
  const first = assertOrigins(rounds[0]!, origins[0]!);
  const second = assertOrigins(rounds[1]!, origins[1]!);
  assert.deepEqual(
    first.terminals.map((outcome) => outcome.kind),
    ['cancelled', 'planned', 'planned', 'satisfied'],
  );
  assert.deepEqual(
    second.terminals.map((outcome) => outcome.kind),
    ['planned', 'planned', 'satisfied'],
  );
  assertFindings(first.report + first.native, second.report + second.native);
  const firstProfile = assertAccounting(first.report, origins[0]!);
  const secondProfile = assertAccounting(second.report, origins[1]!);
  assert.equal(firstProfile.usage.input_tokens.reported, 19 + 38);
  assert.equal(secondProfile.usage.input_tokens.reported, 57);
  assert.equal(planner.attempts, 3);
  assert.equal(planner.identities[0], planner.identities[1]);
  assert.notEqual(planner.identities[1], planner.identities[2]);
}

/** Resolve complete provider findings and durable human answers, including the interrupted attempt. */
function assertFindings(first: string, second: string) {
  assert.match(first, /Provider finding attempt 1/);
  assert.match(first, /Provider finding attempt 2/);
  assert.doesNotMatch(first, /Provider finding attempt 3/);
  assert.match(second, /Provider finding attempt 3/);
  assert.doesNotMatch(second, /Provider finding attempt [12]/);
  assert.match(first, /Original complete answer/);
  assert.match(first, /Every detail and the final conclusion survive/);
  assert.match(second, /Second-round complete answer/);
  assert.match(second, /A different final conclusion/);
  assert.doesNotMatch(second, /Original complete answer/);
}

test('unfinished child recovery retains every attempt exactly once and excludes prior-round usage', async (t) => {
  const f = fixture(t);
  installProvider(f.root);
  const planner = new RefinementPlanner(f.revision);
  const controller = new AbortController();
  const workflow = new Workflow(continuationServices(f.reopen(), planner));
  const outcome = await workflow.refine(
    f.root,
    2,
    unfinishedObserver(controller),
    controller.signal,
  );
  assert.equal(controller.signal.aborted, true, 'the real provider reached reported usage');
  assert.equal(outcome.kind, 'cancelled');
  const rounds = await continueUnfinished(f, planner);
  assertContinuation(f, planner, rounds);
});
