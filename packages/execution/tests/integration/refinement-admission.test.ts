import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { Architecture, Capture } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { Execution } from '../../src/execution.js';
import { HostTask } from '../../src/index.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

/** Provide real Git and SQLite boundaries with a controlled captured authority. */
function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'execution-refine-admission-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = join(directory, 'project');
  mkdirSync(root);
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-b', 'staging');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  writeFileSync(join(root, 'baseline'), 'baseline\n');
  git('add', '.');
  git('commit', '-m', 'baseline');
  git('remote', 'add', 'origin', root);
  writeFileSync(
    join(root, '.git', 'bindings.yaml'),
    `schemaVersion: 1\ntools:\n  codex: ${process.execPath}\n`,
  );
  const capture = authority(root, git('rev-parse', 'HEAD'));
  const architecture = {
    capture: (_root: string, revision?: string) => (revision ? authority(root, revision) : capture),
  } as unknown as Architecture;
  const storage = join(directory, 'state');
  return {
    root,
    execution: new Execution(architecture, new Coordination(storage), storage),
    advance: () => advance(root, git),
  };
}

/** Move the real staging branch after the parent has been admitted. */
function advance(root: string, git: (...args: string[]) => string) {
  writeFileSync(join(root, 'baseline'), 'new staging\n');
  git('add', '.');
  git('commit', '-m', 'new staging');
  return git('rev-parse', 'HEAD');
}

/** Describe the captured authority for the real staging fixture. */
function authority(root: string, revision: string): Capture {
  return {
    source: {
      root,
      revision,
      remote: 'https://github.com/example/refinement.git',
      paths: [],
      read: () => '',
    },
    project: {
      delivery: { baseBranch: 'staging', protectedBranch: 'main' },
      checks: { acceptance: ['fixture'] },
      bindings: '.git/bindings.yaml',
    },
  } as unknown as Capture;
}

test('refinement root resumes unfinished identity and starts fresh after completion', async (t) => {
  const { root, execution } = fixture(t);
  const signal = new AbortController().signal;
  const input = {
    directory: root,
    goal: 'Continuous refinement',
    scope: 'refine',
  };
  const first = await execution.admit(input, signal);
  assert(first instanceof HostTask);
  first.finish({ kind: 'cancelled', reason: 'interrupted', evidence: [] });
  first.close();
  const resumed = await execution.admit(input, signal);
  assert(resumed instanceof HostTask);
  assert.equal(resumed.taskID, first.taskID);
  Reflect.apply(resumed.finish, resumed, [{ kind: 'refined', evidence: [] }]);
  resumed.close();
  const next = await execution.admit(input, signal);
  assert(next instanceof HostTask);
  t.after(() => next.close());
  assert.notEqual(next.taskID, first.taskID);
  Reflect.apply(next.finish, next, [{ kind: 'refined', evidence: [] }]);
});

test('sequential children share the refinement writer while competing roots are refused', async (t) => {
  const { root, execution } = fixture(t);
  const signal = new AbortController().signal;
  const input = {
    directory: root,
    goal: 'Continuous refinement',
    scope: 'refine',
    refinement: true,
  };
  const parent = await execution.admit(input, signal);
  assert(parent instanceof HostTask);
  t.after(() => parent.close());
  for (const phase of ['Plan', 'Architect', 'Goal']) {
    const child = await execution.admit(
      { directory: root, goal: phase, scope: phase },
      signal,
      parent,
    );
    assert(child instanceof HostTask);
    const competing = await execution.admit({ directory: root, goal: 'Competing task' }, signal);
    assert(!(competing instanceof HostTask));
    assert.equal(competing.kind, 'invalid');
    assert.match(competing.reason, /Active goal: Continuous refinement/);
    child.finish({ kind: 'cancelled', reason: 'interrupted', evidence: [] });
    child.close();
  }
  parent.finish({ kind: 'cancelled', reason: 'interrupted', evidence: [] });
});

test('each child admits the current staging revision under the retained parent writer', async (t) => {
  const { root, execution, advance } = fixture(t);
  const signal = new AbortController().signal;
  const input = {
    directory: root,
    goal: 'Continuous refinement',
    scope: 'refine',
    refinement: true,
  };
  const parent = await execution.admit(input, signal);
  assert(parent instanceof HostTask);
  t.after(() => parent.close());
  const revision = advance();
  const child = await execution.admit(
    { directory: root, goal: 'Plan', scope: 'plan' },
    signal,
    parent,
  );
  assert(child instanceof HostTask);
  assert.equal(child.capture.source.revision, revision);
  child.finish({ kind: 'cancelled', reason: 'interrupted', evidence: [] });
  child.close();
  parent.finish({ kind: 'cancelled', reason: 'interrupted', evidence: [] });
});
