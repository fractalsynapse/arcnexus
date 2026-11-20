import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { formatContents } from '../../src/check.js';
import { formatterPreview } from '../../src/formatter.js';

export const suite = {
  owner: 'execution',
  level: 'integration',
  tags: ['native', 'regression'],
} as const;

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

test(
  'the confined formatter materializes a replacement without writing it',
  {
    skip: process.env.ARCNEXUS_NATIVE_TESTS !== '1',
  },
  async (t) => {
    const base = mkdtempSync(join(tmpdir(), 'arcnexus-format-confinement-'));
    t.after(() => rmSync(base, { recursive: true, force: true }));
    const workspace = join(base, 'task');
    const common = join(base, 'git');
    mkdirSync(workspace);
    mkdirSync(common);
    const source = join(workspace, 'example.ts');
    writeFileSync(source, 'const n={count:1};');
    const dependencyRoot = dirname(realpathSync(join(process.cwd(), 'node_modules')));
    const result = await formatContents(
      dependencyRoot,
      workspace,
      common,
      'example.ts',
      'const n={count:2};',
      join(base, 'preview.log'),
      new AbortController().signal,
    );
    assert.equal(result, 'const n = { count: 2 };\n');
    assert.equal(readFileSync(source, 'utf8'), 'const n={count:1};');
  },
);
