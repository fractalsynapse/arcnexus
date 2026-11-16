import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Agent } from '../../../../packages/agent/src/index.js';
import { Architecture } from '../../../../packages/architecture/src/index.js';
import { projectFixture } from '../fixtures/project.js';

const cli = fileURLToPath(new URL('../../src/index.js', import.meta.url));

test('GW-16 and GW-25: the CLI prints the exact prepared model envelope', (t) => {
  const root = projectFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const architecture = new Architecture();
  const agent = new Agent(architecture);
  const capture = architecture.capture(root);
  const selection = { component: 'director', activity: 'planning' };
  const stdout = execFileSync(process.execPath, [cli, 'inspect', 'director', 'planning'], {
    cwd: root,
    encoding: 'utf8',
  });
  const preview = agent.prepareRequest(capture, selection);
  assertHumanOutput(stdout, preview);
  const submitted = agent.prepareRequest(capture, selection, {
    goal: 'Implement a fixture change\nUse the checked edit operation.',
    milestone: { id: 'm1' },
    acceptance: ['test'],
    evidence: ['e1'],
    worktree: root,
  });
  assert.deepEqual(submitted.placeholders, []);
  assert.equal(submitted.request.options.workingDirectory, root);
  assert.match(
    submitted.request.input,
    /Goal: Implement a fixture change\nUse the checked edit operation\./,
  );
  assert.match(submitted.request.input, /Fixture plan template/);
  assert.doesNotMatch(submitted.request.input, /<goal>/);
});

/** Verify that the readable header leads into exactly the prepared prompt. */
function assertHumanOutput(stdout: string, preview: ReturnType<Agent['prepareRequest']>) {
  const marker = '--- Codex input ---\n';
  const start = stdout.indexOf(marker);
  assert(start >= 0, 'default output marks the start of the prompt');
  assert.equal(stdout.slice(start + marker.length), preview.request.input + '\n');
  assert.match(stdout.slice(0, start), /^Invocation options:/m);
  assert.match(preview.request.input, /^Goal: <goal>$/m);
  assert.match(preview.request.input, /^Source: \.arc\/architecture\/roles\/director\.yaml$/m);
  assert.match(preview.request.input, /^Source: \.arc\/architecture\/plan-template\.md$/m);
  assert(preview.placeholders.includes('<goal>'));
}

test('inspection leaves guidance to Codex and creates no task state or worktree', (t) => {
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
  assert.doesNotMatch(output, /Uncommitted instruction|directive|Fixture skill/);
  assert.equal(git('status', '--porcelain'), status);
  assert.equal(git('worktree', 'list', '--porcelain'), worktrees);
  assert(!existsSync(join(root, '.arc/plans')));
});

test('GW-26: both global JSON placements return the exact prepared request', (t) => {
  const root = projectFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const command = ['inspect', 'director', 'planning'];
  const run = (...args: string[]) =>
    execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
  const leading = run('--json', ...command);
  assert.equal(leading, run(...command, '--json'));

  const result = JSON.parse(leading);
  const agent = new Agent(new Architecture());
  assert.deepEqual(
    result,
    agent.inspect({ directory: root, component: 'director', activity: 'planning' }),
  );
  assertHumanOutput(run(...command), result);
});
