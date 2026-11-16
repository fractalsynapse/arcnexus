import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Agent } from '../../../../packages/agent/src/index.js';
import { Architecture } from '../../../../packages/architecture/src/index.js';
import { Manager } from '../../../../packages/manager/src/index.js';
import { projectFixture } from '../fixtures/project.js';

const cli = fileURLToPath(new URL('../../src/index.js', import.meta.url));

test('GW-16 and GW-25: the CLI prints the exact prepared model envelope', (t) => {
  const root = projectFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const architecture = new Architecture(new Manager());
  const agent = new Agent(architecture);
  const capture = architecture.capture(root);
  const selection = { component: 'director', activity: 'planning' };
  const stdout = execFileSync(process.execPath, [cli, 'inspect', 'director', 'planning'], {
    cwd: root,
    encoding: 'utf8',
  });
  const preview = agent.prepareRequest(capture, selection);
  assert.deepEqual(JSON.parse(stdout), preview);
  assert(preview.placeholders.includes('<goal>'));
  const submitted = agent.prepareRequest(capture, selection, {
    goal: 'Implement a fixture change',
    milestone: { id: 'm1' },
    acceptance: ['test'],
    evidence: ['e1'],
    worktree: root,
    skills: [],
  });
  assert.deepEqual(submitted.placeholders, []);
  assert.equal(submitted.request.options.workingDirectory, root);
  assert.match(submitted.request.input, /Implement a fixture change/);
  assert.match(submitted.request.input, /Fixture plan template/);
  assert.doesNotMatch(submitted.request.input, /<goal>/);
});

test('inspection ignores uncommitted guidance and creates no task state or worktree', (t) => {
  const root = projectFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  appendFileSync(join(root, 'AGENTS.md'), '\nUncommitted instruction\n');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  const status = git('status', '--porcelain');
  const worktrees = git('worktree', 'list', '--porcelain');
  const output = execFileSync(process.execPath, [cli, 'inspect', 'work', 'testing'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.doesNotMatch(output, /Uncommitted instruction|Unrelated directive/);
  assert.equal(git('status', '--porcelain'), status);
  assert.equal(git('worktree', 'list', '--porcelain'), worktrees);
  assert(!existsSync(join(root, '.arc/plans')));
});
