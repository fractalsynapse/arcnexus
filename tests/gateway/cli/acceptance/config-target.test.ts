import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';
import { PackageCliFixture } from '../support/package-cli-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Builds registered preceding-schema projects without replacing the production migrator. */
class MigrationTargetFixture extends PackageCliFixture {
  /** Retains stable registration while committing configuration requiring migration. */
  preceding(): void {
    for (const name of readdirSync(join(this.repo, 'architecture/components')))
      this.extend('architecture/components/' + name, (value) => (value.schemaVersion = 5));
    this.commit();
  }

  /** Reads authored schema independently of the CLI's result claims. */
  version(): number {
    return parse(
      readFileSync(join(this.repo, 'architecture/components/platform.yaml'), 'utf8'),
    ).schemaVersion;
  }

  /** Gives another repository a distinct platform with the same package short identity. */
  platform(id: string): void {
    for (const name of readdirSync(join(this.repo, 'architecture/components')))
      this.extend('architecture/components/' + name, (value) => {
        if (value.type === 'platform') value.id = id;
        if (value.parentId === 'platform') value.parentId = id;
      });
    this.commit();
  }
}

for (const target of ['platform', 'platform/package']) {
  test('registered migration previews and applies preceding configuration for ' + target, (t) => {
    const f = new MigrationTargetFixture(t);
    f.register();
    f.preceding();
    const preview = f.value(f.root, 'config', 'migrate', target);
    assert.ok(preview.changes > 0);
    assert.equal(preview.applied, false);
    assert.equal(f.version(), 5);
    assert.equal(f.git('status', '--porcelain'), '');
    const applied = f.value(f.root, 'config', 'migrate', target, '--write');
    assert.equal(applied.applied, true);
    assert.equal(f.version(), 6);
    f.commit();
    assert.equal(f.value(f.root, 'config', 'migrate', target, '--write').changes, 0);
    assert.equal(f.git('status', '--porcelain'), '');
  });
}

test('migration rejects unknown and ambiguous registrations before source mutation', (t) => {
  const f = new MigrationTargetFixture(t),
    other = new MigrationTargetFixture(t);
  f.register();
  other.platform('other');
  f.value(f.root, 'platform', 'create', 'other', other.repo);
  f.value(f.root, 'package', 'create', 'other/package', other.repo);
  for (const target of ['package', 'missing']) {
    const result = f.command(f.root, 'config', 'migrate', target, '--write');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unknown or ambiguous migration target/);
  }
  assert.equal(f.git('status', '--porcelain'), '');
  assert.equal(other.git('status', '--porcelain'), '');
});

test('local migration retains structured preview and rejects dirty write requests', (t) => {
  const f = new MigrationTargetFixture(t);
  f.preceding();
  assert.ok(f.value(f.repo, 'config', 'migrate').changes > 0);
  f.put('untracked.txt', 'Preserve caller work');
  const result = f.command(f.repo, 'config', 'migrate', '--write');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /clean source checkout/);
  assert.equal(f.version(), 5);
});

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
