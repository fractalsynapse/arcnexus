import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
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
