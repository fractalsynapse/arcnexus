import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, type TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { materializeFixture } from '../../testing/support/fixture-payloads.js';

/** Exercises shipped single-owner campaign targets through captured production configuration. */
class MinimalFixtureScenarios {
  /** Each compiled target supplies inherited profiles, exact ownership and operation-only checks. */
  inspect(t: TestContext, name: 'identity' | 'http'): void {
    const repo = this.fixture(t, name);
    const context = new ExecutionContext().resolve(repo);
    assert.deepEqual(context.owners, [name]);
    assert.ok(
      Object.values(context.catalog.components).every((entry) => entry.schemaVersion === 5),
    );
    assert.equal(context.directorProfile, 'astra');
    assert.equal(context.reviewerProfile, 'astra');
    assert.equal(context.catalog.components[name]!.executionProfile, 'luna');
    this.command(
      repo,
      process.execPath,
      name === 'identity' ? ['--test', 'tests/identity.test.mjs'] : ['--check', 'server.mjs'],
    );
  }

  /** Materializes a clean repository with its declared remote identity before catalog discovery. */
  private fixture(t: TestContext, name: 'identity' | 'http'): string {
    const repo = mkdtempSync(join(tmpdir(), 'arcnexus-minimal-fixture-'));
    t.after(() => rmSync(repo, { recursive: true, force: true }));
    materializeFixture(name, repo);
    this.command(repo, 'git', ['init', '-q']);
    const repository = name === 'http' ? 'http-sample' : name;
    this.command(repo, 'git', [
      'remote',
      'add',
      'origin',
      `https://example.invalid/${repository}.git`,
    ]);
    this.command(repo, 'git', ['add', '.']);
    this.command(repo, 'git', [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-qm',
      'Captured fixture',
    ]);
    return repo;
  }

  /** Runs actual compiled payloads and reports bounded diagnostics when a command fails. */
  private command(cwd: string, command: string, args: string[]): void {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr + result.stdout);
  }
}

const scenarios = new MinimalFixtureScenarios();

for (const name of ['identity', 'http'] as const)
  test(`shipped ${name} fixture resolves minimal executable authority`, (t) =>
    scenarios.inspect(t, name));

registerSuite({
  component: 'experiments',
  level: 'acceptance',
  tags: ['deterministic', 'minimal-fixtures'],
});
