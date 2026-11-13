import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import type { TestContext } from 'node:test';
import { SharedTestFixture } from '../../../library/testing/support/shared-test-fixture.js';

/** Exercises package targeting through the built CLI and the actual shared test operations. */
export class PackageCliFixture extends SharedTestFixture {
  /** Declares a local default while retaining a separate maintenance package for scope checks. */
  constructor(t: TestContext) {
    super(t);
    this.extend('.arc/architecture/components/platform.yaml', (value) => {
      value.defaultPackage = 'package';
    });
    this.commit();
  }

  /** Runs with private application state from either the checkout or an unrelated directory. */
  command(cwd: string, ...args: string[]) {
    return spawnSync(process.execPath, [resolve('dist/cli.js'), ...args, '--json'], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        ARCNEXUS_VOLUME: join(this.root, 'volume'),
        ARCNEXUS_STATE_DIR: join(this.root, 'state'),
        XDG_CONFIG_HOME: join(this.root, 'configuration'),
      },
    });
  }

  /** Registers existing declarations without substituting an in-memory portfolio. */
  register(): void {
    for (const [kind, id] of [
      ['platform', 'platform'],
      ['package', 'platform/package'],
    ]) {
      const result = this.command(this.root, kind!, 'create', id!, this.repo);
      assert.equal(result.status, 0, result.stderr);
    }
  }

  /** Requires successful execution before interpreting a selection or retained report. */
  value(cwd: string, ...args: string[]): any {
    const result = this.command(cwd, ...args);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }
}
