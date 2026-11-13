import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

/** Exercises the generated executable and the gateway's effective ownership boundary. */
class CliTests {
  /** Verifies that generated CLI executable preserves help, version and invalid-command behavior. */
  executableContract(): void {
    const help = this.run('--help');
    assert.equal(help.status, 0, help.stderr);
    for (const family of ['workday', 'experiment', 'validate', 'task', 'test'])
      assert.ok(help.stdout.includes(family), family);
    const version = this.run('--version');
    assert.equal(version.status, 0, version.stderr);
    assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+$/);
    assert.equal(this.run('unknown-command').status, 2);
  }

  /** Retired campaigns fail before opening missing inputs and are absent from the production build. */
  retiredCampaign(): void {
    const result = this.run('experiment', 'run', '/missing/campaign.json');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /retired.*test inspect\/run/);
    assert.match(result.stderr, /task run.*--simulate/);
    assert.doesNotMatch(result.stderr, /ENOENT/);
    assert.doesNotMatch(this.run('--help').stdout, /experiment run/);
    assert.equal(existsSync(resolve('dist/library/experiments/prompt-campaign.js')), false);
    assert.equal(existsSync(resolve('dist/library/experiments/experiments.js')), false);
  }

  /** Verifies that the CLI gateway owns its test directory without project-wide write access. */
  ownsItsTests(): void {
    const result = this.run(
      'inspect',
      'cli',
      'Inspect gateway responsibility',
      '--project',
      process.cwd(),
      '--json',
    );
    assert.equal(result.status, 0, String(result.error ?? result.stderr));
    const owner = JSON.parse(result.stdout).context.at(-1);
    assert.ok(owner.allowedWritePaths.includes('tests/gateway/cli'));
    assert.ok(owner.allowedWritePaths.includes('src/gateway/cli'));
    // Derived reads are all `access` holds: ownership above is the only statement of write scope,
    // so a second write grant cannot reappear here unnoticed.
    assert.deepEqual(Object.keys(owner.access), ['readPaths']);
    assert.ok(!owner.allowedWritePaths.includes('.'));
    assert.ok(!owner.allowedWritePaths.includes('src/cli.ts'));
  }

  /** Executes this lifecycle through its configured collaborators and propagates failures. */
  private run(...args: string[]) {
    return spawnSync(resolve('dist/cli.js'), args, {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  }
}

const suite = new CliTests();

test('scripted campaign execution is retired before input access', () => suite.retiredCampaign());

test('generated CLI executable preserves help, version and invalid-command behavior', () =>
  suite.executableContract());

test('CLI gateway owns its test directory without project-wide write access', () =>
  suite.ownsItsTests());

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
