import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../dist/library/testing/suite.js';

/** Exercises the actual bootstrap entry point with only npm's external process boundary controlled. */
class DependencyInstallScenarios {
  /** Confirms applicable artifacts are fetched once before an offline install with lifecycle hooks enabled. */
  install(t: TestContext): void {
    const fixture = this.fixture(t);
    this.lock(fixture.root, {
      'node_modules/a': this.entry('a'),
      'node_modules/b': this.entry('a'),
      'node_modules/d': this.entry('d'),
      'node_modules/c': { ...this.entry('c'), os: ['!' + process.platform] },
    });
    const result = fixture.run();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fixture.calls(), [
      [
        'cache',
        'add',
        'https://registry.npmjs.org/a.tgz',
        'https://registry.npmjs.org/d.tgz',
        '--maxsockets=1',
        '--ignore-scripts',
        '--prefer-offline',
      ],
      ['ci', '--offline', '--no-audit', '--no-fund'],
    ]);
  }

  /** An empty applicable lock does not invoke cache add without required package arguments. */
  empty(t: TestContext): void {
    const fixture = this.fixture(t);
    this.lock(fixture.root, {});
    const result = fixture.run();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fixture.calls(), [['ci', '--offline', '--no-audit', '--no-fund']]);
  }

  /** Rejects unsupported sources before even an earlier valid entry starts a download. */
  invalid(t: TestContext): void {
    const fixture = this.fixture(t);
    this.lock(fixture.root, {
      'node_modules/a': this.entry('a'),
      'node_modules/b': { resolved: 'file:../outside', integrity: 'sha512-example' },
    });
    const result = fixture.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unauthenticated HTTPS/);
    assert.deepEqual(fixture.calls(), []);
  }

  /** Leaves a failed download visible and never masks it with retries or a subsequent installation. */
  failed(t: TestContext): void {
    const fixture = this.fixture(t, true);
    this.lock(fixture.root, { 'node_modules/a': this.entry('a') });
    const result = fixture.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Dependency preparation failed \(9\)/);
    assert.equal(fixture.calls().length, 1);
  }

  /** Supplies a locked artifact; actual integrity validation remains npm ci's responsibility. */
  private entry(name: string) {
    return { resolved: `https://registry.npmjs.org/${name}.tgz`, integrity: 'sha512-example' };
  }

  /** Writes minimal version-three lock authority for this isolated scenario. */
  private lock(root: string, packages: object): void {
    writeFileSync(
      join(root, 'package-lock.json'),
      JSON.stringify({ lockfileVersion: 3, packages }),
    );
  }

  /** Records subprocess argv without invoking a registry or modifying repository dependencies. */
  private fixture(t: TestContext, fail = false) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-dependencies-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const log = join(root, 'calls.jsonl');
    writeFileSync(
      join(root, 'npm'),
      `#!${process.execPath}\nrequire('fs').appendFileSync(${JSON.stringify(log)},JSON.stringify(process.argv.slice(2))+'\\n');process.exit(${fail ? 9 : 0});`,
      { mode: 0o700 },
    );
    return {
      root,
      run: () =>
        spawnSync(process.execPath, [resolve('scripts/foundation/install-dependencies.mjs')], {
          cwd: root,
          encoding: 'utf8',
          env: { ...process.env, PATH: root + ':' + process.env.PATH },
        }),
      calls: () =>
        existsSync(log)
          ? readFileSync(log, 'utf8')
              .trim()
              .split('\n')
              .map((line) => JSON.parse(line))
          : [],
    };
  }
}

const scenarios = new DependencyInstallScenarios();

test('bootstrap caches applicable locked artifacts before offline installation', (t) =>
  scenarios.install(t));

test('bootstrap installs an empty lock without a cache invocation', (t) => scenarios.empty(t));

test('bootstrap rejects unsupported sources before any download', (t) => scenarios.invalid(t));

test('bootstrap does not retry or install after a failed download', (t) => scenarios.failed(t));

registerSuite({
  component: 'foundation',
  level: 'acceptance',
  tags: ['deterministic', 'dependency-install'],
});
