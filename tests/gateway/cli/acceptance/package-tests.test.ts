import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { PackageCliFixture } from '../support/package-cli-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

test('registered package test inspection works outside a checkout and intersects filters', (t) => {
  const f = new PackageCliFixture(t);
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
  const f = new PackageCliFixture(t);
  const result = f.value(f.repo, 'test', 'inspect', '--component', 'sample');
  assert.equal(result.packageId, 'package');
  assert.equal(existsSync(join(f.root, 'volume')), false);
  f.extend('.arc/architecture/components/platform.yaml', (value) => {
    delete value.defaultPackage;
  });
  f.commit();
  const ambiguous = f.command(f.repo, 'test', 'inspect');
  assert.equal(ambiguous.status, 2);
  assert.match(ambiguous.stderr, /Ambiguous or missing package/);
});

test('package targeting rejects foreign components and conflicting legacy selection', (t) => {
  const f = new PackageCliFixture(t);
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
    const f = new PackageCliFixture(t);
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
  const f = new PackageCliFixture(t);
  for (const args of [['--component', ''], [''], ['--level', '']]) {
    const result = f.command(f.repo, 'test', 'inspect', ...args);
    assert.equal(result.status, 2, result.stdout);
    assert.match(result.stderr, /empty/i);
  }
});

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic', 'native-host'] });
