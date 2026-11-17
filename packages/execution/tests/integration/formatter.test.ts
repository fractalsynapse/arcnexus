import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { formatterPreview } from '../../src/formatter.js';

test('formatting can be previewed on stdout without changing checked source', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-format-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const workspace = join(root, 'task');
  mkdirSync(workspace);
  const source = join(workspace, 'example.ts');
  const input = 'const n={count:1};';
  writeFileSync(source, input);
  const dependencyRoot = dirname(realpathSync(join(process.cwd(), 'node_modules')));
  const preview = formatterPreview(dependencyRoot);
  assert(preview);
  const { entry } = preview;
  const output = execFileSync(process.execPath, [entry, source], {
    cwd: workspace,
    encoding: 'utf8',
  });
  assert.match(output, /const n = \{ count: 1 \};/);
  assert.equal(execFileSync('/usr/bin/cat', [source], { encoding: 'utf8' }), input);
  const alias = join(root, 'node_modules/prettier/bin/prettier.cjs');
  mkdirSync(dirname(alias), { recursive: true });
  symlinkSync(entry, alias);
  assert.equal(formatterPreview(root), undefined);
});
