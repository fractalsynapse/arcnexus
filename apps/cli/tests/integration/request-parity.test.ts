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
  assertHumanOutput(stdout, preview);
  const submitted = agent.prepareRequest(capture, selection, {
    goal: 'Implement a fixture change\nUse the checked edit operation.',
    milestone: { id: 'm1' },
    acceptance: ['test'],
    evidence: ['e1'],
    worktree: root,
    skills: [],
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
  assert.match(
    preview.request.input,
    /Source: AGENTS\.md\n--- BEGIN AGENTS\.md ---\nFixture root directive\n# Fixture heading\n--- END AGENTS\.md ---/,
  );
  assert.match(preview.request.input, /^Source: \.arc\/architecture\/roles\/director\.yaml$/m);
  assert(preview.placeholders.includes('<goal>'));
}

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
