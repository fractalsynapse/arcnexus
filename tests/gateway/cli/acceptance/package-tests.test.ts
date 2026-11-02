import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { SharedTestFixture } from '../../../library/testing/support/shared-test-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises package targeting through the built CLI and the actual shared test operations. */
class PackageTestFixture extends SharedTestFixture {
  /** Declares a local default while retaining a separate maintenance package for scope checks. */
  constructor(t: TestContext) {
    super(t);
    this.extend('architecture/components/platform.yaml', (value) => {
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

test('registered package test inspection works outside a checkout and intersects filters', (t) => {
  const f = new PackageTestFixture(t);
  f.register();
  const result = f.value(
    f.root,
    'test',
    'inspect',
    'platform/package',
    '--component',
    'sample',
    '--level',
    'unit',
    '--tag',
    'fast',
  );
  assert.equal(result.project, f.repo);
  assert.equal(result.packageId, 'package');
  assert.ok(result.suites.length);
  assert.ok(
    result.suites.every((suite: any) => suite.component === 'sample' && suite.level === 'unit'),
  );
  assert.equal(f.git('status', '--porcelain'), '');
});

test('local test selection uses the declared default without portfolio registration', (t) => {
  const f = new PackageTestFixture(t);
  const result = f.value(f.repo, 'test', 'inspect', '--component', 'sample');
  assert.equal(result.packageId, 'package');
  assert.equal(existsSync(join(f.root, 'volume')), false);
  f.extend('architecture/components/platform.yaml', (value) => {
    delete value.defaultPackage;
  });
  f.commit();
  const ambiguous = f.command(f.repo, 'test', 'inspect');
  assert.equal(ambiguous.status, 2);
  assert.match(ambiguous.stderr, /Ambiguous or missing package/);
});

test('package targeting rejects foreign components and conflicting legacy selection', (t) => {
  const f = new PackageTestFixture(t);
  f.register();
  const foreign = f.command(
    f.root,
    'test',
    'inspect',
    'platform/package',
    '--component',
    'maintenance',
  );
  assert.equal(foreign.status, 2);
  assert.match(foreign.stderr, /outside|Unknown component/);
  const conflict = f.command(
    f.root,
    'test',
    'inspect',
    'sample',
    '--project',
    f.repo,
    '--component',
    'sample',
  );
  assert.equal(conflict.status, 2);
  assert.match(conflict.stderr, /combine|positional/);
});

test(
  'registered package test execution uses real shared preparation and retained evidence',
  { skip: !process.env.ARCNEXUS_TEST_CODEX && 'Requires installed confinement' },
  (t) => {
    const f = new PackageTestFixture(t);
    f.register();
    const result = f.value(
      f.root,
      'test',
      'run',
      'platform/package',
      '--component',
      'sample',
      '--level',
      'unit',
    );
    assert.equal(result.status, 'passed');
    assert.equal(result.selection.packageId, 'package');
    assert.equal(result.productionBuild, 'service-prepared');
    assert.ok(result.commands.length >= 2);
    assert.ok(result.operationEvidence);
    assert.equal(f.git('status', '--porcelain'), '');
  },
);

test('empty explicit test targets cannot silently broaden selection', (t) => {
  const f = new PackageTestFixture(t);
  for (const args of [['--component', ''], [''], ['--level', '']]) {
    const result = f.command(f.repo, 'test', 'inspect', ...args);
    assert.equal(result.status, 2, result.stdout);
    assert.match(result.stderr, /empty/i);
  }
});

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic', 'native-host'] });
