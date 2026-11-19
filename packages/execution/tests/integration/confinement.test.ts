import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { Capture } from '../../../architecture/src/index.js';
import { hasOwnerTestSuites } from '../../../foundation/src/index.js';
import { check } from '../../src/check.js';
import { applyEdits } from '../../src/edits.js';

/** Use a small capture with two owners and one locked contract. */
function capture(root: string) {
  return {
    source: { root },
    project: { contractRegistry: 'owned/registry.yaml' },
    components: { one: { id: 'one', owns: ['owned'] }, two: { id: 'two', owns: ['other'] } },
    contracts: [{ file: 'owned/contract.md', stage: 'locked' }],
    operations: {},
  } as unknown as Capture;
}

/** Create disposable workspace inputs and host-private evidence beside them. */
function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-confinement-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const workspace = join(root, 'workspace');
  mkdirSync(join(workspace, 'owned'), { recursive: true });
  const path = join(workspace, 'owned/file.txt');
  writeFileSync(path, 'before');
  return { root, workspace, path };
}

test('EX-1–EX-5: checked edits enforce ownership, byte identity, locks and aliases', (t) => {
  const { root, workspace, path } = fixture(t);
  const authority = capture(workspace);
  const expected = createHash('sha256').update('before').digest('hex');
  const edit = { path: 'owned/file.txt', expected, content: 'after' };
  assert.throws(
    () => applyEdits(workspace, authority, 'one', [{ ...edit, expected: null }]),
    /Stale/,
  );
  assert.throws(() => applyEdits(workspace, authority, 'two', [edit]), /captured owners: one/);
  for (const name of ['owned/contract.md', 'owned/registry.yaml']) {
    assert.throws(
      () => applyEdits(workspace, authority, 'one', [{ ...edit, path: name }]),
      /Locked/,
    );
  }
  symlinkSync(root, join(workspace, 'owned/alias'));
  assert.throws(
    () => applyEdits(workspace, authority, 'one', [{ ...edit, path: 'owned/alias/file' }]),
    /Unsafe/,
  );
  assert.equal(readFileSync(path, 'utf8'), 'before');
  const [observed] = applyEdits(workspace, authority, 'one', [edit]);
  assert.equal(observed?.before, expected);
  assert.equal(readFileSync(path, 'utf8'), 'after');
});

test('EX-5: checked edits refuse hard links and preserve both names', (t) => {
  const { workspace, path } = fixture(t);
  const authority = capture(workspace);
  const original = readFileSync(path);
  const expected = createHash('sha256').update(original).digest('hex');
  const linkedPath = join(workspace, 'owned/hard-link.txt');
  linkSync(path, linkedPath);

  const edit = { path: 'owned/hard-link.txt', expected, content: 'after' };
  assert.throws(
    () => applyEdits(workspace, authority, 'one', [edit]),
    /Unsafe checked edit alias: owned\/hard-link\.txt/,
  );
  assert.deepEqual(readFileSync(path), original);
  assert.deepEqual(readFileSync(linkedPath), original);
});

/** Declare a fixture operation that probes its disposable write and read bounds. */
function nativeCapture(workspace: string, privatePath: string) {
  return {
    ...capture(workspace),
    operations: {
      native: {
        id: 'native',
        category: 'build',
        network: false,
        command: 'node',
        args: [
          '-e',
          `const fs = require('fs'); if (fs.existsSync(${JSON.stringify(privatePath)})) process.exit(46); fs.writeFileSync('owned/file.txt', 'overlay'); console.log('confined');`,
        ],
      },
    },
  };
}

/** Give the owner check an observable command and the captured suite prerequisite. */
function ownerCheckCapture(workspace: string, required = false) {
  const authority = capture(workspace);
  return {
    ...authority,
    project: { ...authority.project, checks: { acceptance: required ? ['owner-tests'] : [] } },
    components: {
      ...authority.components,
      one: { ...authority.components.one!, owns: ['owned', 'packages/one'] },
      two: { ...authority.components.two!, owns: ['other', 'packages/two'] },
    },
    operations: {
      'owner-tests': {
        id: 'owner-tests',
        category: 'integration-test',
        command: 'printf',
        args: ['owner check executed'],
        network: false,
        applicability: 'owner-test-suites' as const,
      },
    },
  };
}

test('an unknown owner cannot be reported as having no test suites', async (t) => {
  const { root, workspace } = fixture(t);
  const common = join(root, 'common');
  mkdirSync(common);
  await assert.rejects(
    check(
      ownerCheckCapture(workspace),
      workspace,
      common,
      'owner-tests',
      'unknown',
      join(root, 'unknown.log'),
      AbortSignal.timeout(5_000),
    ),
    /unknown/i,
  );
});

test('candidate ownership drift is refused before declaring owner tests inapplicable', async (t) => {
  const { root, workspace } = fixture(t);
  const common = join(root, 'common');
  const components = join(workspace, '.arc/architecture/components');
  mkdirSync(common);
  mkdirSync(components, { recursive: true });
  writeFileSync(join(components, 'one.yaml'), 'id: one\nowns:\n  - other\n');
  writeFileSync(join(components, 'two.yaml'), 'id: two\nowns:\n  - owned\n');
  await assert.rejects(
    check(
      ownerCheckCapture(workspace),
      workspace,
      common,
      'owner-tests',
      'one',
      join(root, 'drift.log'),
      AbortSignal.timeout(5_000),
    ),
    /ownership|drift|authority/i,
  );
});

test('an optional owner check without a suite records inapplicability before execution', async (t) => {
  const { root, workspace } = fixture(t);
  const common = join(root, 'common');
  mkdirSync(common);
  const otherSuite = join(workspace, 'packages/two/tests/unit');
  mkdirSync(otherSuite, { recursive: true });
  writeFileSync(join(otherSuite, 'other.test.ts'), '');
  const result = await check(
    ownerCheckCapture(workspace),
    workspace,
    common,
    'owner-tests',
    'one',
    join(root, 'check.log'),
    AbortSignal.timeout(5_000),
  );
  assert.equal(result.status, 'not-applicable');
  assert.equal(
    readFileSync(result.log, 'utf8'),
    'Not applicable: No test suites for one in the current worktree\n',
  );
});

test(
  'an added source suite and a required check both reach the confined command',
  { skip: process.env.ARCNEXUS_NATIVE_TESTS !== '1' },
  async (t) => {
    const { root, workspace } = fixture(t);
    const common = join(root, 'common');
    mkdirSync(common);
    for (const required of [true, false]) {
      const suite = join(workspace, 'packages/one/tests/unit');
      if (!required) {
        mkdirSync(suite, { recursive: true });
        writeFileSync(join(suite, 'new.test.ts'), '');
      }
      const result = await check(
        ownerCheckCapture(workspace, required),
        workspace,
        common,
        'owner-tests',
        'one',
        join(root, `check-${required}.log`),
        AbortSignal.timeout(5_000),
      );
      assert.equal(result.status, 0);
      assert.match(readFileSync(result.log, 'utf8'), /owner check executed/);
    }
  },
);

test(
  'EX-10: native check writes stay in the disposable overlay',
  { skip: process.env.ARCNEXUS_NATIVE_TESTS !== '1' },
  async (t) => {
    const { root, workspace, path } = fixture(t);
    const common = join(root, 'common');
    const privatePath = join(root, 'outside');
    mkdirSync(common);
    writeFileSync(privatePath, 'outside');
    const authority = nativeCapture(workspace, privatePath);
    const result = await check(
      authority,
      workspace,
      common,
      'native',
      undefined,
      join(root, 'check.log'),
      AbortSignal.timeout(5_000),
    );
    assert.equal(
      result.status,
      0,
      existsSync(result.log) ? readFileSync(result.log, 'utf8') : 'missing log',
    );
    assert.match(readFileSync(result.log, 'utf8'), /confined/);
    assert.equal(readFileSync(path, 'utf8'), 'before');
  },
);
