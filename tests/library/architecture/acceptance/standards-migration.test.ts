import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { ComponentV5Fixture } from '../support/component-v5-fixture.js';

/** Exercises a complete preceding configuration family through the public maintenance command. */
class StandardsMigrationFixture extends ComponentV5Fixture {
  /** Adds declared policy and a standard whose definition has exact maintained ownership. */
  configure(): void {
    this.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    this.extend('platform', {
      director: { component: 'sample', profile: 'luna' },
      reviewerProfile: 'luna',
      defaultPackage: 'package',
      patterns: ['readable'],
    });
    const owner = this.read('maintenance');
    this.extend('maintenance', { owns: [...owner.owns, 'architecture/patterns/readable.json'] });
    this.put('architecture/patterns/readable.json', {
      schemaVersion: 1,
      id: 'readable',
      owner: 'sample',
      purpose: 'Explain behavior',
      applicability: 'Implementation',
      document: 'docs/value.md',
      examples: [],
      operationIds: [],
    });
    this.commit();
  }

  /** Reads authored declarations independently of the product migration result. */
  read(id: string): any {
    return JSON.parse(readFileSync(join(this.root, `architecture/components/${id}.json`), 'utf8'));
  }

  /** Retains unrelated authored fields when adding a migration precondition. */
  private extend(id: string, fields: object): void {
    this.put(`architecture/components/${id}.json`, { ...this.read(id), ...fields });
  }

  /** Runs the assembled migrator with case-private evidence storage. */
  migrate(...args: string[]) {
    return spawnSync(process.execPath, [resolve('dist/cli.js'), 'config', 'migrate', ...args], {
      cwd: this.root,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, ARCNEXUS_STATE_DIR: this.root + '-state' },
    });
  }
}

test('v5 standards migration preserves ownership, previews without writes and is idempotent', (t) => {
  const f = new StandardsMigrationFixture(t);
  t.after(() => rmSync(f.root + '-state', { recursive: true, force: true }));
  f.configure();
  const preview = f.migrate();
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /standards/);
  assert.equal(f.read('platform').schemaVersion, 5);
  const applied = f.migrate('--write');
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(f.read('platform').schemaVersion, 6);
  assert.deepEqual(f.read('platform').standards, ['readable']);
  assert.equal(f.read('platform').patterns, undefined);
  assert.ok(f.read('maintenance').owns.includes('architecture/standards/readable.json'));
  assert.equal(existsSync(join(f.root, 'architecture/patterns/readable.json')), false);
  f.commit();
  const second = f.migrate('--write');
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /No configuration changes/);
});

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });

test('standards migration refuses an existing destination without changing source', (t) => {
  const f = new StandardsMigrationFixture(t);
  t.after(() => rmSync(f.root + '-state', { recursive: true, force: true }));
  f.configure();
  const owner = f.read('maintenance');
  f.put('architecture/components/maintenance.json', {
    ...owner,
    owns: [...owner.owns, 'architecture/standards'],
  });
  f.put(
    'architecture/standards/readable.json',
    JSON.parse(readFileSync(join(f.root, 'architecture/patterns/readable.json'), 'utf8')),
  );
  f.commit();
  const result = f.migrate('--write');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Conflicting standard migration destination/);
  assert.equal(f.read('platform').schemaVersion, 5);
  assert.equal(f.git('status', '--porcelain'), '');
});
