import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { Architecture, Capture } from '../../../architecture/src/index.js';
import { Coordination } from '../../../coordination/src/index.js';
import { Execution } from '../../src/execution.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

/** Build a Git staging ref and isolated Coordination database. */
function fixture(t: import('node:test').TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'execution-round-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-b', 'staging');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  writeFileSync(join(root, 'baseline'), 'baseline\n');
  git('add', 'baseline');
  git('commit', '-m', 'baseline');
  git('remote', 'add', 'origin', root);
  const revision = git('rev-parse', 'HEAD');
  return inventoryFixture(root, revision);
}

/** Supply a mutable captured inventory backed by the same real journal store. */
function inventoryFixture(root: string, revision: string) {
  let body = '---\npriority: 1\n---\nFirst goal\n';
  const capture = {
    source: {
      root,
      revision,
      remote: 'https://example.invalid/fixture.git',
      paths: ['.arc/goals/first.md'],
      read: () => body,
    },
    project: {
      knowledgeRoot: '.arc',
      delivery: { baseBranch: 'staging', protectedBranch: 'main' },
    },
  } as unknown as Capture;
  const architecture = { capture: () => capture } as unknown as Architecture;
  const execution = new Execution(
    architecture,
    new Coordination(join(root, 'state')),
    join(root, 'state'),
  );
  return {
    root,
    execution,
    setBody: (value: string) => {
      body = value;
    },
  };
}

test('refinement inventory is isolated from an unfinished standalone round', (t) => {
  const { root, execution, setBody } = fixture(t);
  const standalone = execution.round(root);
  setBody('---\npriority: 1\n---\nRevised goal\n');
  const refinement = Reflect.apply(execution.round, execution, [root, 'refine:invocation:1']);
  assert.notEqual(refinement.id, standalone.id);
  assert.equal(refinement.goals[0].body, 'Revised goal\n');
  setBody('---\npriority: 1\n---\nLater goal\n');
  const resumed = Reflect.apply(execution.round, execution, [root, 'refine:invocation:1']);
  assert.deepEqual(resumed.goals, refinement.goals);
  assert.deepEqual(execution.round(root).goals, standalone.goals);
});
