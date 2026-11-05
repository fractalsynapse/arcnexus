import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../dist/library/testing/suite.js';

/** Exercises the actual bootstrap entry point with only the download and npm process boundaries controlled. */
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
    const [download, cache, install] = fixture.calls();
    assert.deepEqual(
      download.filter((_: string, i: number) => download[i - 1] === '--url'),
      ['https://registry.npmjs.org/a.tgz', 'https://registry.npmjs.org/d.tgz'],
    );
    const archives = download.filter((_: string, i: number) => download[i - 1] === '--output');
    assert.deepEqual(
      archives.map((path: string) => basename(path)),
      ['0.tgz', '1.tgz'],
    );
    assert.deepEqual(cache, ['npm', 'cache', 'add', '--offline', '--ignore-scripts', ...archives]);
    assert.deepEqual(install, ['npm', 'ci', '--offline', '--no-audit', '--no-fund']);
    assert.equal(existsSync(dirname(archives[0])), false);
  }

  /** An empty applicable lock does not invoke cache add without required package arguments. */
  empty(t: TestContext): void {
    const fixture = this.fixture(t);
    this.lock(fixture.root, {});
    const result = fixture.run();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fixture.calls(), [['npm', 'ci', '--offline', '--no-audit', '--no-fund']]);
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

  /** Real npm refuses a valid substitute archive whose content differs from the frozen lock. */
  integrity(t: TestContext): void {
    const fixture = this.fixture(t);
    rmSync(join(fixture.root, 'npm'));
    const archive = this.archive(fixture.root);
    const copier = `const args=process.argv.slice(2);require('fs').copyFileSync(${JSON.stringify(archive)},args[args.indexOf('--output')+1]);`;
    writeFileSync(join(fixture.root, 'curl'), `#!${process.execPath}\n${copier}`);
    const entry = {
      ...this.entry('a'),
      version: '1.0.0',
      integrity: 'sha512-' + Buffer.alloc(64).toString('base64'),
    };
    const dependencies = { a: '1.0.0' };
    writeFileSync(
      join(fixture.root, 'package.json'),
      JSON.stringify({ name: 'consumer', version: '1.0.0', dependencies }),
    );
    this.lock(fixture.root, { '': { dependencies }, 'node_modules/a': entry });
    const result = fixture.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ENOTCACHED|EINTEGRITY/);
    assert.equal(existsSync(join(fixture.root, 'node_modules/a/package.json')), false);
  }

  /** Packages controlled bytes locally so the integrity check never needs a registry or credentials. */
  private archive(root: string): string {
    mkdirSync(join(root, 'package'));
    writeFileSync(
      join(root, 'package/package.json'),
      JSON.stringify({ name: 'a', version: '1.0.0' }),
    );
    const archive = join(root, 'substitute.tgz');
    execFileSync('tar', ['-czf', archive, '-C', root, 'package']);
    return archive;
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

  /** Records each child invocation in order and optionally makes the first command fail. */
  private recordCommands(root: string, log: string, fail: boolean): void {
    for (const executable of ['curl', 'npm'])
      writeFileSync(
        join(root, executable),
        `#!${process.execPath}\nrequire('fs').appendFileSync(${JSON.stringify(log)},JSON.stringify([${JSON.stringify(executable)},...process.argv.slice(2)])+'\\n');process.exit(${fail ? 9 : 0});`,
        { mode: 0o700 },
      );
  }

  /** Records subprocess argv without invoking a registry or modifying repository dependencies. */
  private fixture(t: TestContext, fail = false) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-dependencies-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const log = join(root, 'calls.jsonl');
    this.recordCommands(root, log, fail);
    return {
      root,
      run: () =>
        spawnSync(process.execPath, [resolve('scripts/foundation/install-dependencies.mjs')], {
          cwd: root,
          encoding: 'utf8',
          env: {
            ...process.env,
            npm_config_cache: join(root, 'cache'),
            PATH: root + ':' + process.env.PATH,
          },
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

test('offline install refuses locally cached archives with different locked integrity', (t) =>
  scenarios.integrity(t));

test('bootstrap rejects unsupported sources before any download', (t) => scenarios.invalid(t));

test('bootstrap does not retry or install after a failed download', (t) => scenarios.failed(t));

registerSuite({
  component: 'foundation',
  level: 'acceptance',
  tags: ['deterministic', 'dependency-install'],
});
