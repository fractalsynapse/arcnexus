import assert from 'node:assert/strict';
import { globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import type { Capture } from '../../../architecture/src/index.js';
import { selectQualityInputs } from '../../../foundation/src/index.js';
import { check } from '../../src/check.js';

for (const [operation, applicability] of [
  ['format:check', 'owner-format-files'],
  ['lint', 'owner-lint-files'],
] as const) {
  test(`host applicability agrees with Foundation ${operation} selection`, async (t) => {
    const root = process.cwd();
    const components = Object.fromEntries(
      globSync('.arc/architecture/components/*.yaml').map((path) => {
        const component = parse(readFileSync(path, 'utf8')) as { id: string; owns: string[] };
        return [component.id, component];
      }),
    );
    let owner = '';
    for (const candidate of Object.keys(components)) {
      const selection = await selectQualityInputs(operation, candidate);
      if (selection.files.length === 0) {
        owner = candidate;
        break;
      }
    }
    assert.ok(owner, 'fixture requires an owner with no selected inputs');
    const selection = await selectQualityInputs(operation, owner);
    const temporary = mkdtempSync(join(tmpdir(), 'arcnexus-quality-parity-'));
    t.after(() => rmSync(temporary, { recursive: true, force: true }));
    const capture = {
      source: {
        root,
        paths: [...globSync('.arc/architecture/components/*.yaml'), 'package.json', 'packages/foundation/scripts/owner-quality.ts'].sort(),
        read: (path: string) => readFileSync(join(root, path), 'utf8'),
      },
      project: { checks: { acceptance: [] } },
      components,
      operations: {
        quality: {
          id: 'quality',
          category: 'build',
          command: 'npm',
          args: ['run', operation, '--', { context: 'owner' }],
          network: false,
          tool: 'check',
          applicability,
        },
      },
    } as unknown as Capture;
    const result = await check(
      capture,
      root,
      temporary,
      'quality',
      owner,
      join(temporary, 'quality.log'),
      AbortSignal.timeout(30_000),
    );
    assert.equal(result.status === 'not-applicable', selection.files.length === 0);
  });
}

test('worktree selection and receipt use the candidate with a nested command cwd', async (t) => {
  const host = process.cwd();
  const hostSelection = await selectQualityInputs('format:check', 'execution');
  assert.ok(hostSelection.files.length, 'host must have execution format inputs');
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-selection-worktree-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const worktree = join(root, 'worktree');
  const components = join(worktree, '.arc/architecture/components');
  mkdirSync(components, { recursive: true });
  mkdirSync(join(worktree, 'nested'));
  const declaration = 'id: execution\nowns:\n  - packages/execution\n';
  writeFileSync(join(components, 'execution.yaml'), declaration);
  const capture = {
    source: {
      root: host,
      paths: ['.arc/architecture/components/execution.yaml'],
      read: (path: string) => (path.endsWith('execution.yaml') ? declaration : ''),
    },
    project: { checks: { acceptance: [] } },
    components: { execution: { id: 'execution', owns: ['packages/execution'] } },
    operations: {
      quality: {
        id: 'quality',
        category: 'build',
        command: 'npm',
        args: ['run', 'format:check', '--', { context: 'owner' }],
        cwd: 'nested',
        network: false,
        tool: 'check',
        applicability: 'owner-format-files',
      },
    },
  } as unknown as Capture;
  const log = join(root, 'selection.log');
  const result = await check(
    capture,
    worktree,
    root,
    'quality',
    'execution',
    log,
    AbortSignal.timeout(30_000),
  );
  assert.equal(result.status, 'not-applicable');
  assert.equal(result.cwd, join(worktree, 'nested'));
  assert.equal(result.command, 'npm');
  assert.deepEqual(result.args, ['run', 'format:check', '--', 'execution']);
  assert.equal(result.reason, 'No format:check files for execution in the current worktree');
  assert.equal(readFileSync(log, 'utf8'), `Not applicable: ${result.reason}\n`);
});

test('deleting every candidate component file is ownership drift', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-deleted-ownership-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const capture = {
    source: { root, paths: ['.arc/architecture/components/owner.yaml'] },
    project: { checks: { acceptance: [] } },
    components: { owner: { id: 'owner', owns: ['fixture.ts'] } },
    operations: {
      quality: {
        id: 'quality',
        category: 'build',
        command: '/usr/bin/true',
        args: [],
        cwd: '.',
        network: false,
        applicability: 'owner-test-suites',
      },
    },
  } as unknown as Capture;
  await assert.rejects(
    check(
      capture,
      root,
      root,
      'quality',
      'owner',
      join(root, 'quality.log'),
      AbortSignal.timeout(30_000),
    ),
    /ownership drift/i,
  );
});
