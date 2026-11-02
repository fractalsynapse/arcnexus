import assert from 'node:assert/strict';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Qualifies snapshot identity when empty input directories have stricter permissions than the caller's umask. */
class RunnerPermissionsScenarios {
  /** Captures actual production snapshot code without weakening mode or byte hashing. */
  async preserves(t: TestContext): Promise<void> {
    const root = mkdtempSync(join(tmpdir(), 'runner-permissions-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const installation = join(root, 'installation');
    const entry = this.install(installation);
    const { RunnerSnapshot } = await import(pathToFileURL(entry).href);
    const previous = process.umask(0o002);
    try {
      const runner = new RunnerSnapshot().capture(join(root, 'state'));
      assert.match(runner.hash, /^[a-f0-9]{64}$/);
      assert.equal(statSync(join(runner.directory, 'node_modules/empty')).mode & 0o777, 0o755);
      assert.equal(statSync(join(installation, 'node_modules/empty')).mode & 0o777, 0o755);
    } finally {
      process.umask(previous);
    }
  }

  /** Packages the built snapshot module in a minimal disposable installation with an empty input directory. */
  private install(directory: string): string {
    const module = 'dist/library/execution-runtime/runner-snapshot.js';
    mkdirSync(join(directory, 'dist/library/execution-runtime'), { recursive: true });
    mkdirSync(join(directory, 'node_modules/empty'), { recursive: true });
    chmodSync(join(directory, 'node_modules/empty'), 0o755);
    cpSync(resolve(module), join(directory, module));
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ type: 'module' }));
    writeFileSync(join(directory, 'package-lock.json'), '{}');
    return join(directory, module);
  }
}

const scenarios = new RunnerPermissionsScenarios();

test('runner capture preserves empty directory modes under a different umask', (t) =>
  scenarios.preserves(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['deterministic', 'host-lifecycle'],
});
