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
import { Execution } from '../../../execution/src/index.js';
import {
  Workflow,
  type TaskObserver,
  type TaskSession,
  type WorkflowServices,
} from '../../src/index.js';

export const suite = { owner: 'workflow', level: 'integration', tags: ['regression'] } as const;

type State = ReturnType<typeof services>;

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

test('a successful child is reused durably with exact origins and no repeated assessment', async (t) => {
  const f = fixture(t);
  installProvider(f.root);
  const planner = new RefinementPlanner(f.revision, false);
  const workflow = new Workflow(continuationServices(f.reopen(), planner));
  const outcome = await workflow.refine(
    f.root,
    2,
    interruptingObserver(),
    new AbortController().signal,
  );
  assert.equal(outcome.kind, 'failed');
  const rounds = await continueUnfinished(f, planner);
  assert.equal(planner.attempts, 2, 'successful first child is reused; next round is assessed');
  assert.deepEqual(
    rounds.map(({ round }) => round),
    [1, 2],
  );
  assertSuccessfulRecovery(f, planner, rounds);
});

/** Resolve both completed rounds and the durable reuse event to their complete native origins. */
function assertSuccessfulRecovery(
  f: ReturnType<typeof fixture>,
  planner: RefinementPlanner,
  rounds: CompletedRefinementRound[],
) {
  const results = reconcileRounds(f, planner, rounds);
  assert.match(results[0]!.report, /Reused completed child outcome for refine:/);
  assert.doesNotMatch(results[1]!.report, /Reused completed child outcome for refine:/);
  assert.match(results[0]!.native, /Provider finding attempt 1/);
  assert.doesNotMatch(results[0]!.native, /Provider finding attempt 2/);
  assert.match(results[1]!.native, /Provider finding attempt 2/);
  assert.doesNotMatch(results[1]!.native, /Provider finding attempt 1/);
  for (const result of results)
    assert.deepEqual(
      result.terminals.map((outcome) => outcome.kind),
      ['planned', 'planned', 'satisfied'],
    );
}

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
      answer: async (question) =>
        question === 'Complete answer 2'
          ? 'Resumed complete answer.\nA distinguishable continuation and its entire conclusion.'
          : 'Second-round complete answer.\nA different final conclusion.',
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
  const [first, second] = reconcileRounds(f, planner, rounds);
  assert.ok(first);
  assert.ok(second);
  assert.deepEqual(
    first.terminals.map((outcome) => outcome.kind),
    ['cancelled', 'planned', 'planned', 'satisfied'],
  );
  assert.deepEqual(
    second.terminals.map((outcome) => outcome.kind),
    ['planned', 'planned', 'satisfied'],
  );
  assertFindings(first.report + first.native, second.report + second.native);

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
  assert.match(first, /Resumed complete answer/);
  assert.match(first, /A distinguishable continuation and its entire conclusion/);
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

/** Compare each completed round with independent canonical origins and provider accounting. */
function reconcileRounds(
  f: ReturnType<typeof fixture>,
  planner: RefinementPlanner,
  rounds: CompletedRefinementRound[],
) {
  return rounds.map((completion) => {
    const origins = history(
      join(f.directory, 'state'),
      f.reopen().capture.source.remote,
      planner.tasks.get(completion.round)!,
    );
    const result = assertOrigins(completion, origins);
    assertAccounting(result.report, origins);
    return result;
  });
}
