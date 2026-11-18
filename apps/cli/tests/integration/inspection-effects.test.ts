import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { projectFixture } from '../fixtures/project.js';

const cli = fileURLToPath(new URL('../../src/index.js', import.meta.url));

/** Capture every file and directory, including ignored files and Git state. */
function snapshot(root: string, relative = ''): string[] {
  return readdirSync(join(root, relative), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = join(relative, entry.name);
      if (entry.isDirectory()) return [`directory:${path}`, ...snapshot(root, path)];
      if (!entry.isFile()) return [`other:${path}`];
      const hash = createHash('sha256').update(readFileSync(join(root, path))).digest('hex');
      return [`file:${path}:${hash}`];
    });
}

test('inspection preserves all project files and directories across selections and errors', (t) => {
  const root = projectFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const before = snapshot(root);
  for (const args of [
    ['inspect', 'director', 'planning'],
    ['--json', 'inspect', 'reviewer', 'assessment'],
    ['inspect', 'work', 'testing', '--json'],
    ['inspect', 'direction', 'planning'],
    ['inspect', 'missing', 'testing'],
    ['inspect', 'work', 'missing'],
    ['inspect'],
    ['inspect', 'work'],
    ['inspect', 'work', 'testing', 'extra'],
    ['inspect', 'work', '--json', 'testing'],
    ['inspect', 'work', 'testing', '--json', '--json'],
    ['--json', 'inspect', 'work', 'testing', '--json'],
  ]) {
    const first = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
    const second = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
    const invalidFlag = args.filter((arg) => arg === '--json').length > 1 || args[2] === '--json';
    const expected =
      args.includes('missing') || args.includes('extra') || args.length < 3 || invalidFlag ? 2 : 0;
    assert.equal(first.status, expected, first.stderr);
    assert.equal(second.status, expected, second.stderr);
    if (expected === 0) {
      assert.notEqual(first.stdout, '');
      assert.equal(first.stderr, '');
    } else {
      assert.equal(first.stdout, '');
      assert.notEqual(first.stderr, '');
    }
    assert.equal(second.stdout, first.stdout);
    assert.equal(second.stderr, first.stderr);
    assert.deepEqual(snapshot(root), before);
  }
});
