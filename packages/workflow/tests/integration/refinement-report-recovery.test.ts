import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { Architecture, Capture } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { Execution, hostTask } from '../../../execution/src/index.js';
import { Workflow, type TaskObserver, type WorkflowServices } from '../../src/index.js';

export const suite = { owner: 'workflow', level: 'integration', tags: ['regression'] } as const;

type Refine = (
  directory: string,
  rounds: number,
  observer: TaskObserver,
  signal: AbortSignal,
) => Promise<unknown>;

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

/** Reopen the same project authority and application storage with fresh service objects. */
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

/** Supply one measured Planner child and normal successful Architect and goal outcomes. */
function providers(state: ReturnType<typeof services>, planner: () => unknown) {
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
    planner: planner() as WorkflowServices['planner'],
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

/** Read the completed round's public observer event. */
function completion(events: readonly unknown[]) {
  const event = events.find((item) => {
    const observation = Reflect.get(item as object, 'observation');
    return (
      typeof observation === 'object' && observation !== null && 'completedRound' in observation
    );
  });
  assert.ok(event);
  return Reflect.get(Reflect.get(event as object, 'observation') as object, 'completedRound') as {
    report: string;
    findings: readonly string[];
    measurements: readonly string[];
  };
}

test('reopened recovery reports complete origins and exact round profile usage without replay', async (t) => {
  const f = fixture(t);
  let plannerCalls = 0;
  const planner = () => ({
    propose: async (
      session: Parameters<NonNullable<WorkflowServices['planner']>['propose']>[0],
    ) => {
      plannerCalls++;
      const answer = await session.ask?.(
        'Retain this complete answer',
        new AbortController().signal,
      );
      session.record({ phase: 'question', message: `Complete answer: ${answer}` });
      const task = hostTask(session);
      const activation = 'fixture-planner-activation';
      const nativeSource = task.store(
        'provider-turn.json',
        JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 17, output_tokens: 5 } }),
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
        nativeEvent: {
          activation,
          kind: 'event',
          source: nativeSource,
          event: { type: 'turn.completed', usage: { input_tokens: 17, output_tokens: 5 } },
        },
      });
      task.note({ nativeFinished: { activation, durationMs: 7 } });
      return {
        kind: 'planned' as const,
        commit: f.revision,
        summary: `Distinct Planner finding attempt ${plannerCalls}`,
        evidence: [],
      };
    },
    apply: async () => ({ kind: 'completed', evidence: [] }),
  });
  const first = new Workflow(providers(f.reopen(), planner));
  const refine = Reflect.get(first, 'refine') as Refine;
  const interrupted = await refine.call(
    first,
    f.root,
    1,
    {
      progress() {},
      answer: async () =>
        'The complete answer is retained verbatim, including its full conclusion.',
      event(event) {
        const observation = Reflect.get(event, 'observation');
        const outcome =
          typeof observation === 'object' && observation !== null
            ? Reflect.get(observation, 'outcome')
            : undefined;
        if (typeof outcome === 'object' && outcome?.kind === 'planned')
          throw new Error('Interrupt after child terminal commit');
      },
    },
    new AbortController().signal,
  );
  assert.equal(Reflect.get(interrupted as object, 'kind'), 'failed');
  assert.equal(plannerCalls, 1);

  const resumed = new Workflow(
    providers(f.reopen(), () => ({
      propose: async () => {
        plannerCalls++;
        throw new Error('A successful child must not be assessed again');
      },
      apply: async () => ({ kind: 'completed', evidence: [] }),
    })),
  );
  const events: unknown[] = [];
  await (Reflect.get(resumed, 'refine') as Refine).call(
    resumed,
    f.root,
    1,
    { progress() {}, event: (event) => events.push(event) },
    new AbortController().signal,
  );

  const round = completion(events);
  const report = readFileSync(round.report, 'utf8');
  assert.match(report, /Distinct Planner finding attempt 1/);
  assert.doesNotMatch(report, /Distinct Planner finding attempt 2/);
  assert.match(report, /The complete answer is retained verbatim, including its full conclusion\./);
  assert.match(report, /Reused completed child outcome for refine:/);
  assert.equal(plannerCalls, 1);
  assert.equal(new Set(round.findings).size, round.findings.length);
  assert.equal(new Set(round.measurements).size, round.measurements.length);
  assert.equal(round.measurements.length, 3);
  assert.match(report, /"profile": "planner-fixture"/);
  assert.match(report, /"input_tokens": \{\n\s+"reported": 17/);
  assert.match(report, /"output_tokens": \{\n\s+"reported": 5/);
  assert.match(report, /"cost": \{\n\s+"estimate": null/);
});
