import { registerSuite } from '../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';

/** Checks cleanup through the built production entry point before compiler dispatch. */
class BuildOutputTests {
  /** Refuses a generated-root alias before cleanup can delete files in another directory. */
  rejectsRootAlias(t: TestContext): void {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-output-alias-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    mkdirSync(join(root, 'maintained'));
    writeFileSync(join(root, 'maintained/source.ts'), 'keep');
    symlinkSync(join(root, 'maintained'), join(root, '.test-build'));
    const result = spawnSync(process.execPath, [resolve('.tool-build/build.js'), '--tests'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Generated output root must be a real directory/);
    assert.equal(readFileSync(join(root, 'maintained/source.ts'), 'utf8'), 'keep');
  }

  /** Preserves mount identity and external files even when the subsequent compiler fails. */
  preservesRoot(t: TestContext, tests = false): void {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-build-output-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const output = join(root, tests ? '.test-build' : 'dist');
    mkdirSync(join(output, 'nested'), { recursive: true });
    writeFileSync(join(output, 'nested/stale.js'), 'stale');
    writeFileSync(join(root, 'maintained.txt'), 'unchanged');
    symlinkSync(join(root, 'maintained.txt'), join(output, 'stale-link'));
    const before = statSync(output);
    const result = spawnSync(
      process.execPath,
      [resolve('.tool-build/build.js'), ...(tests ? ['--tests'] : [])],
      {
        cwd: root,
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /TypeScript compilation failed/);
    assert.equal(readFileSync(join(root, 'maintained.txt'), 'utf8'), 'unchanged');
    assert.equal(existsSync(join(output, 'nested/stale.js')), false);
    assert.equal(existsSync(join(output, 'stale-link')), false);
    assert.equal(existsSync(output), true, 'generated output root must survive cleanup');
    assert.equal(statSync(output).ino, before.ino, 'mount directory cannot be replaced');
  }
}

const suite = new BuildOutputTests();

test('production build preserves generated mounts and removes stale output links', (t) =>
  suite.preservesRoot(t));

test('test compilation clears obsolete suites without replacing its generated mount', (t) =>
  suite.preservesRoot(t, true));

test('test compilation refuses an aliased output root before deleting files', (t) =>
  suite.rejectsRootAlias(t));

registerSuite({ component: 'foundation', level: 'acceptance', tags: ['deterministic'] });
