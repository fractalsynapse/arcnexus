import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import {
  captureWorktreeBindings,
  loadProjectBindings,
} from '../../../../dist/library/architecture/bindings.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { MinimalCatalogFixture } from '../../testing/support/minimal-catalog-fixture.js';

/** Reproduces fresh CLI discovery in a linked worktree backed by an isolated local remote. */
class DiscoveryFixture extends MinimalCatalogFixture {
  readonly workspace = this.root + '-worktree';

  readonly remote = this.root + '-remote';

  /** Keeps the declared upstream intact while using actual local Git materialization. */
  constructor(t: TestContext) {
    super(t);
    this.git('clone', '--bare', this.root, this.remote);
    this.git('remote', 'set-url', 'origin', this.remote);
    this.git('worktree', 'add', '-b', 'candidate', this.workspace, 'HEAD');
    t.after(() => {
      rmSync(this.workspace, { recursive: true, force: true });
      rmSync(this.remote, { recursive: true, force: true });
      rmSync(this.root + '-volume', { recursive: true, force: true });
    });
  }

  /** Writes the same private snapshot used by production workspace preparation. */
  capture() {
    return captureWorktreeBindings(this.workspace, {
      schemaVersion: 1,
      tools: {},
      repositories: {},
      materializations: {
        sample: {
          source: this.root,
          commonDir: join(this.root, '.git'),
          base: this.git('rev-parse', 'HEAD'),
          repository: 'https://example.invalid/sample.git',
          origin: this.remote,
        },
      },
    })!;
  }

  /** Invokes the ordinary CLI without an injected catalog or special simulation option. */
  validate() {
    return spawnSync(
      process.execPath,
      [resolve('dist/cli.js'), 'platform', 'create', 'platform', this.workspace, '--json'],
      {
        cwd: this.workspace,
        env: { ...process.env, ARCNEXUS_VOLUME: this.root + '-volume' },
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      },
    );
  }
}

test('fresh built CLI registers isolated worktree identity without changing declared upstream', (t) => {
  const f = new DiscoveryFixture(t);
  assert.match(f.validate().stderr, /origin identity mismatch/);
  const capture = f.capture();
  const result = f.validate();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).id, 'platform');
  assert.match(capture.sha256, /^[a-f0-9]{64}$/);
  assert.equal(loadProjectBindings(f.workspace).materializations!.sample!.source, f.workspace);
  assert.match(
    readFileSync(join(f.workspace, '.arc/architecture/environment.json'), 'utf8'),
    /example.invalid/,
  );
  assert.equal(f.git('status', '--porcelain'), '');
  assert.throws(() => f.capture(), /EEXIST/);
});

test('worktree discovery rejects changed remote and aliased private snapshot', (t) => {
  const f = new DiscoveryFixture(t);
  const capture = f.capture();
  f.git('remote', 'set-url', 'origin', 'https://example.invalid/other.git');
  assert.throws(() => loadProjectBindings(f.workspace), /materialization changed/);
  f.git('remote', 'set-url', 'origin', f.remote);
  const other = join(f.root, '.arc/architecture/environment.json');
  rmSync(capture.path);
  symlinkSync(other, capture.path);
  assert.throws(() => loadProjectBindings(f.workspace), /Unsafe.*metadata/);
});

registerSuite({
  component: 'architecture',
  level: 'acceptance',
  tags: ['deterministic', 'lifecycle-effects'],
});
