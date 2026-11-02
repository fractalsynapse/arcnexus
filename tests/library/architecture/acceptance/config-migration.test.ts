import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { MigrationFixture } from '../support/migration-fixture.js';

/** Qualifies dry-run, validated application and idempotence through the assembled maintenance command. */
class ConfigMigrationScenarios {
  /** Preview exposes the actual change without staging or altering source; write preserves identity and behavior. */
  previewAndWrite(t: TestContext): void {
    const fixture = new MigrationFixture(t);
    assert.equal(fixture.run('validate').status, 0);
    const head = fixture.git('rev-parse', 'HEAD');
    const preview = fixture.migrate();
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /schemaVersion/);
    assert.equal(fixture.git('status', '--porcelain'), '');
    const applied = fixture.migrate('--write');
    assert.equal(applied.status, 0, applied.stderr);
    assert.equal(fixture.git('rev-parse', 'HEAD'), head);
    assert.equal(fixture.git('diff', '--cached'), '');
    const sample = JSON.parse(
      readFileSync(join(fixture.root, 'architecture/components/sample.json'), 'utf8'),
    );
    assert.equal(sample.schemaVersion, 6);
    assert.equal(sample.id, 'sample');
    assert.deepEqual(sample.owns, ['package']);
    fixture.commit();
    const validated = fixture.run('validate');
    assert.equal(validated.status, 0, validated.stderr);
    const repeated = fixture.migrate('--write');
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.equal(fixture.git('status', '--porcelain'), '');
    assert.match(repeated.stdout, /No configuration changes/);
  }

  /** Refuses obsolete executable budgets before a migration can publish unusable minimal authority. */
  obsoleteBudget(t: TestContext): void {
    const fixture = new MigrationFixture(t);
    const path = 'architecture/execution-profiles/luna.json';
    const profile = JSON.parse(readFileSync(join(fixture.root, path), 'utf8'));
    fixture.put(path, { ...profile, schemaVersion: 2, maxOperationCalls: 2 });
    fixture.commit();
    const result = fixture.migrate('--write');
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /obsolete.*maxOperationCalls/);
    assert.equal(fixture.git('status', '--porcelain'), '');
  }

  /** Unowned historical files require an explicit owner decision instead of a guessed writable migration. */
  excludedOwnership(t: TestContext): void {
    const fixture = new MigrationFixture(t);
    const path = 'architecture/components/platform.json';
    const platform = JSON.parse(readFileSync(join(fixture.root, path), 'utf8'));
    platform.coverageExclusions = [{ path: 'history.json', reason: 'Historical evidence' }];
    fixture.put(path, platform);
    fixture.put('history.json', { outcome: 'retained' });
    fixture.commit();
    const head = fixture.git('rev-parse', 'HEAD');
    const result = fixture.migrate('--write');
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /history.json requires exactly one owner/);
    assert.equal(fixture.git('status', '--porcelain'), '');
    assert.equal(fixture.git('rev-parse', 'HEAD'), head);
  }

  /** Dirty source must not be overwritten even when the architectural declarations could otherwise migrate. */
  dirty(t: TestContext): void {
    const fixture = new MigrationFixture(t);
    const path = join(fixture.root, 'package/src/value.ts');
    writeFileSync(path, 'export const value = 2;');
    const result = fixture.migrate('--write');
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /clean/i);
    assert.equal(readFileSync(path, 'utf8'), 'export const value = 2;');
    assert.equal(fixture.git('diff', '--cached'), '');
  }
}

const scenarios = new ConfigMigrationScenarios();

test('config migration rejects obsolete executable profile budgets before writing source', (t) =>
  scenarios.obsoleteBudget(t));

test('config migrate previews and applies validated minimal declarations idempotently', (t) =>
  scenarios.previewAndWrite(t));

test('config migrate write rejects a dirty checkout before source application', (t) =>
  scenarios.dirty(t));

test('config migration refuses to guess ownership for excluded historical evidence', (t) =>
  scenarios.excludedOwnership(t));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
