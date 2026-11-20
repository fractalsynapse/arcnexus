import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { Agent } from '../../../agent/src/index.js';
import type { Architecture, Capture, TaskContext } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { Execution, HostTask } from '../../../execution/src/index.js';
import { Workflow, type WorkflowServices } from '../../src/index.js';

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
    components: {},
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

/** Read completed-round payloads from the public journal event envelope. */
function completedRounds(events: readonly unknown[]) {
  return events.flatMap((event) => {
    if (typeof event !== 'object' || event === null) return [];
    const observation = Reflect.get(event, 'observation');
    if (typeof observation !== 'object' || observation === null) return [];
    const round = Reflect.get(observation, 'completedRound');
    return typeof round === 'object' && round !== null ? [round as Record<string, unknown>] : [];
  });
}

/** Observe the contexts prepared by the real host for each assessment. */
function observingServices(f: ReturnType<typeof fixture>, contexts: TaskContext[]) {
  const services = providers(f, []);
  const agent = {
    activate: async (input: { task: TaskContext }) => {
      contexts.push(input.task);
      return {};
    },
  } as unknown as Agent;
  const activate = async (session: import('../../src/index.js').TaskSession, component: string) => {
    await (session as HostTask).activate(
      agent,
      { component, activity: 'planning' },
      { assignment: {}, acceptance: [] },
      new AbortController().signal,
    );
  };
  services.planner!.propose = async (session) => {
    await activate(session, 'planner');
    return { kind: 'planned', commit: f.revision, summary: 'First round finding', evidence: [] };
  };
  services.architecture!.propose = async (session) => {
    await activate(session, 'architecture');
    return { kind: 'no-change', summary: 'Architecture finding', evidence: [] };
  };
  services.direction.plan = async (session) => {
    await activate(session, 'direction');
    return assessGoal(session, []);
  };
  return services;
}

test('later assessments receive the actual completed round in their prepared context', async (t) => {
  const f = fixture(t);
  const contexts: TaskContext[] = [];
  const services = observingServices(f, contexts);
  const rounds: Record<string, unknown>[] = [];
  const outcome = await new Workflow(services).refine(
    f.root,
    2,
    { progress() {}, event: (event) => rounds.push(...completedRounds([event])) },
    new AbortController().signal,
  );
  assert.equal(outcome.kind, 'planned', JSON.stringify(outcome));
  assert.equal(rounds.length, 2);
  const prior = rounds[0]!;
  for (const context of contexts.slice(4)) {
    const prepared = JSON.stringify(context);
    assert.ok(
      prepared.includes(String(prior.report)),
      'prepared assessment references prior report',
    );
    for (const finding of prior.findings as string[])
      assert.ok(prepared.includes(finding), 'prepared assessment retains each originating finding');
  }
});
