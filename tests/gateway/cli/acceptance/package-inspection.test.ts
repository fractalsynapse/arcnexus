import assert from 'node:assert/strict';
import { ArchitectureInspection } from '../../../../dist/library/architecture/inspection.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { PackageCliFixture } from '../support/package-cli-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

test('registered architectural inspection captures context without starting engineering', (t) => {
  const f = new PackageCliFixture(t);
  f.register();
  const result = f.value(f.root, 'inspect', 'platform/package', 'sample');
  assert.equal(result.packageId, 'package');
  assert.equal(result.componentId, 'sample');
  assert.equal(result.revision, f.git('rev-parse', 'HEAD'));
  assert.deepEqual(
    result.context.map((c: any) => c.id),
    ['platform', 'package', 'sample'],
  );
  assert.equal(result.preview, undefined);
  assert.ok(Array.isArray(result.publicApi));
  assert.equal(existsSync(join(f.root, 'state')), false);
  assert.equal(f.git('status', '--porcelain'), '');
});

test('activity inspection previews the declared activity frame without inventing acceptance', (t) => {
  const f = new PackageCliFixture(t);
  f.register();
  // The activity is named, never inferred from prose: the component slot plus the activity slot are
  // the whole request, and no acceptance is created by looking at it.
  const result = f.value(f.root, 'inspect', 'package', 'sample', 'review');
  assert.equal(result.mode, 'steward');
  assert.equal(result.activity, 'review');
  assert.match(result.frame, /Activity: review/);
  assert.equal(result.assignment, undefined);
  assert.equal(existsSync(join(f.root, 'state')), false);
  assert.equal(f.git('status', '--porcelain'), '');
});

test('architectural inspection rejects foreign owners, empty prompts and unsupported activity', (t) => {
  const f = new PackageCliFixture(t);
  f.register();
  for (const args of [
    ['platform/package', 'maintenance'],
    ['platform/package', 'missing'],
    ['platform/package', ''],
    ['platform/package', 'sample', ''],
    ['platform/package', 'sample', '--activity', 'invent'],
    ['platform/package', 'sample', '--model', 'override'],
  ]) {
    const result = f.command(f.root, 'inspect', ...args);
    assert.equal(result.status, 2, result.stdout);
  }
  assert.equal(existsSync(join(f.root, 'state')), false);
});

test('inspection services retain captured revisions while new CLI previews follow committed source', (t) => {
  const f = new PackageCliFixture(t);
  f.register();
  const revision = f.git('rev-parse', 'HEAD');
  f.extend('.arc/architecture/components/sample.yaml', (value) => {
    value.purpose = 'Maintain the newly selected intent';
  });
  f.commit();
  const retained = new ArchitectureInspection().inspect({
    source: f.repo,
    revision,
    packageId: 'package',
    componentId: 'sample',
  });
  assert.equal((retained.context.at(-1) as any).purpose, 'Own test selection');
  const current = f.value(f.root, 'inspect', 'package', 'sample', 'review');
  assert.equal(current.context.at(-1).purpose, 'Maintain the newly selected intent');
  assert.equal(current.activity, 'review');
  assert.notEqual(current.revision, retained.revision);
  assert.equal(existsSync(join(f.root, 'state')), false);
});

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
