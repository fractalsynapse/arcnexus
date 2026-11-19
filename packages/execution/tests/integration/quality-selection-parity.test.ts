import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
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
      paths: ['.arc/architecture/components/execution.yaml', 'package.json', 'packages/foundation/scripts/owner-quality.ts'],
      read: (path: string) => path.endsWith('execution.yaml') ? declaration : readFileSync(join(host, path), 'utf8'),
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

test('nonempty selection executes the captured command from its nested cwd', async (t) => {
  const host = process.cwd();
  const selection = await selectQualityInputs('format:check', 'execution');
  assert.ok(selection.files.length, 'host must have execution format inputs');
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-selection-worktree-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const worktree = join(root, 'worktree');
  prepareNestedWorktree(host, worktree);
  const log = join(root, 'selection.log');
  const result = await check(
    nestedCapture(host),
    worktree,
    root,
    'quality',
    'execution',
    log,
    AbortSignal.timeout(30_000),
  );
  assertNestedCommand(result, worktree);
  if (!assertComposedCommand(result, log, t)) return;
  assertConfinedCommand(result, log);
});

/** Populate the candidate with one selected file and its declared component owners. */
function prepareNestedWorktree(host: string, worktree: string) {
  const components = join(worktree, '.arc/architecture/components');
  mkdirSync(components, { recursive: true });
  mkdirSync(join(worktree, 'nested'));
  mkdirSync(join(worktree, 'packages/execution'), { recursive: true });
  writeFileSync(join(worktree, 'packages/execution/input.ts'), 'export const value = 1;\n');
  cpSync(join(host, 'packages/foundation'), join(worktree, 'packages/foundation'), { recursive: true });
  cpSync(join(host, 'packages/team'), join(worktree, 'packages/team'), { recursive: true });
  cpSync(join(host, 'package.json'), join(worktree, 'package.json'));
  symlinkSync(join(host, 'node_modules'), join(worktree, 'node_modules'), 'dir');
  writeFileSync(join(components, 'execution.yaml'), 'id: execution\nowns:\n  - packages/execution\n');
  writeFileSync(join(components, 'foundation.yaml'), foundationDeclaration);
}

const foundationDeclaration =
  'id: foundation\nowns:\n  - package.json\n  - packages/foundation\n  - packages/team\n';

/** Capture an owner-scoped formatter operation with a nested command directory. */
function nestedCapture(host: string) {
  const declaration = 'id: execution\nowns:\n  - packages/execution\n';
  return {
    source: {
      root: host,
      paths: ['.arc/architecture/components/execution.yaml', '.arc/architecture/components/foundation.yaml', 'package.json', 'packages/foundation/scripts/owner-quality.ts'],
      read: (path: string) => path.endsWith('execution.yaml') ? declaration : path.endsWith('foundation.yaml') ? foundationDeclaration : readFileSync(join(host, path), 'utf8'),
    },
    project: { checks: { acceptance: [] } },
    components: { execution: { id: 'execution', owns: ['packages/execution'] }, foundation: { id: 'foundation', owns: ['package.json', 'packages/foundation', 'packages/team'] } },
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
}

/** Assert the candidate command uses Foundation's explicit-root selection and receipt. */
function assertNestedCommand(result: Awaited<ReturnType<typeof check>>, worktree: string) {
  assert.equal(result.cwd, join(worktree, 'nested'));
  assert.equal(result.command, 'npm');
  assert.deepEqual(result.args, ['run', 'format:check', '--', 'execution']);
  assert.deepEqual(result.selection?.files, ['packages/execution/input.ts']);
}

/** Exercise the actual candidate command when the outer sandbox disallows nested confinement. */
function assertComposedCommand(
  result: Awaited<ReturnType<typeof check>>,
  log: string,
  t: TestContext,
) {
  const composed = spawnSync('npm', result.args, { cwd: result.cwd, encoding: 'utf8' });
  const output = (composed.stdout ?? '') + (composed.stderr ?? '');
  assert.equal(composed.status, 0, output);
  assert.match(output, new RegExp(`format:check scope=execution sha256=${result.selection!.identity}`));
  assert.match(output, /format:check scope=execution inputs=1 /);
  const confinedLog = readFileSync(log, 'utf8');
  if (result.status !== 0 && unavailableConfinement(confinedLog)) {
    t.skip(`Native confinement unavailable: ${confinedLog.trim()}`);
    return false;
  }
  return true;
}

/** Identify only nested Bubblewrap setup failures that prevent native confinement. */
function unavailableConfinement(log: string) {
  return /bwrap:.*(operation not permitted|creating new namespace|no permissions to create a new namespace|permission denied)/i.test(log);
}

/** Require the confined receipt when the runtime supports nested confinement. */
function assertConfinedCommand(result: Awaited<ReturnType<typeof check>>, log: string) {
  const confinedLog = readFileSync(log, 'utf8');
  if (result.status !== 0 && unavailableConfinement(confinedLog)) return;
  assert.equal(result.status, 0, confinedLog);
  assert.match(confinedLog, new RegExp(`format:check scope=execution sha256=${result.selection!.identity}`));
  assert.match(confinedLog, /format:check scope=execution inputs=1 /);
}

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
