import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Portfolio } from '../../../../dist/library/portfolio/portfolio.js';
import { ExecutionLease } from '../../../../dist/library/coordination-store/execution-store.js';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { PackageCliFixture } from '../support/package-cli-fixture.js';

/** Exercises committed architectural mutations through the assembled CLI outside a checkout. */
class ArchitectureUpdateScenarios {
  /** Updates all registered resource kinds while preserving the caller's files, index and HEAD. */
  updates(t: TestContext): void {
    const f = new PackageCliFixture(t);
    f.register();
    const head = f.git('rev-parse', 'HEAD');
    const path = join(f.repo, 'architecture/components/sample.yaml');
    const original = readFileSync(path, 'utf8');
    writeFileSync(path, original + '\n# caller change\n');
    const before = f.git('status', '--porcelain');
    const result = f.value(
      f.root,
      'component',
      'update',
      'package',
      'sample',
      'purpose=New purpose',
      'objectives=["Preserve A=B"]',
    );
    assert.equal(result.purpose, 'New purpose');
    assert.deepEqual(result.objectives, ['Preserve A=B']);
    assert.equal(f.value(f.root, 'component', 'get', 'package', 'sample').purpose, 'New purpose');
    f.value(f.root, 'platform', 'update', 'platform', 'purpose=Updated platform');
    f.value(f.root, 'package', 'update', 'package', 'purpose=Updated package');
    assert.equal(f.value(f.root, 'platform', 'get', 'platform').purpose, 'Updated platform');
    assert.equal(f.value(f.root, 'package', 'get', 'package').purpose, 'Updated package');
    assert.equal(f.value(f.root, 'component', 'get', 'package', 'sample').purpose, 'New purpose');
    assert.equal(f.git('rev-parse', 'HEAD'), head);
    assert.equal(f.git('status', '--porcelain'), before);
    assert.equal(readFileSync(path, 'utf8'), original + '\n# caller change\n');
  }

  /** Rejects malformed patches, foreign targets and broken ownership without selecting a new revision. */
  rejects(t: TestContext): void {
    const f = new PackageCliFixture(t);
    f.register();
    const before = f.value(f.root, 'package', 'get', 'package');
    for (const patch of [
      'id=other',
      'schemaVersion=5',
      'path=src',
      'owns=[]',
      'purpose=',
      'purpose',
    ]) {
      const result = f.command(f.root, 'component', 'update', 'package', 'sample', patch);
      assert.equal(result.status, 2, result.stderr);
    }
    for (const args of [
      ['sample', 'purpose=one', 'purpose=two'],
      ['maintenance', 'purpose=foreign'],
      ['missing', 'purpose=missing'],
    ])
      assert.equal(f.command(f.root, 'component', 'update', 'package', ...args).status, 2);
    assert.deepEqual(f.value(f.root, 'package', 'get', 'package'), before);
    assert.equal(f.git('status', '--porcelain'), '');
  }

  /** Exercises stale API revisions and the exact selected target consumed by registered execution. */
  revisions(t: TestContext): void {
    const f = new PackageCliFixture(t);
    f.register();
    const service = new Portfolio(join(f.root, 'volume'), true);
    try {
      const before = service.get('package', 'package');
      const selected = service.update(
        'package',
        'package',
        { purpose: 'Selected' },
        before.revision,
      );
      assert.notEqual(selected.base, before.base);
      assert.equal(service.packageTarget('package').base, selected.base);
      assert.throws(
        () => service.update('package', 'package', { purpose: 'Stale' }, before.revision),
        /revision changed/,
      );
      assert.equal(service.get('package', 'package').base, selected.base);
      assert.equal(
        service.update('package', 'package', { purpose: 'Selected' }).base,
        selected.base,
      );
      assert.throws(() => service.update('package', 'package', { id: 'renamed' }), /immutable/);
    } finally {
      service.close();
    }
  }

  /** Refuses writes through read-only services and concurrent hosts without changing selected authority. */
  lease(t: TestContext): void {
    const f = new PackageCliFixture(t);
    f.register();
    const reader = new Portfolio(join(f.root, 'volume'));
    try {
      assert.throws(() => reader.update('package', 'package', { purpose: 'Denied' }), /read-only/);
    } finally {
      reader.close();
    }
    const lease = new ExecutionLease(join(f.repo, '.git/arcnexus/host.lease.sqlite'));
    try {
      const result = f.command(
        f.root,
        'component',
        'update',
        'package',
        'sample',
        'purpose=Blocked',
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /host already owns/);
      assert.equal(
        f.value(f.root, 'component', 'get', 'package', 'sample').purpose,
        'Own test selection',
      );
    } finally {
      lease.close();
    }
  }

  /** Refuses a redirected application branch before Git can advance an unrelated caller branch. */
  symbolic(t: TestContext): void {
    const f = new PackageCliFixture(t);
    f.register();
    f.value(f.root, 'component', 'update', 'package', 'sample', 'purpose=First');
    const base = f.value(f.root, 'package', 'get', 'package').base;
    const ref = f.git('for-each-ref', '--format=%(refname)', 'refs/heads/arcnexus/configuration/');
    f.git('branch', 'caller', base);
    f.git('symbolic-ref', ref, 'refs/heads/caller');
    const result = f.command(f.root, 'component', 'update', 'package', 'sample', 'purpose=Blocked');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /branch is symbolic/);
    assert.equal(f.git('rev-parse', 'caller'), base);
    assert.equal(f.value(f.root, 'package', 'get', 'package').base, base);
  }

  /** Restores crash-boundary database state while keeping actual immutable commits and local branches. */
  private interrupt(f: PackageCliFixture, branchApplied: boolean) {
    const db = new DatabaseSync(join(f.root, 'volume/portfolio.sqlite'));
    try {
      const row = db.prepare('SELECT data FROM architecture_mutations').get()!;
      const intent = JSON.parse(String(row.data));
      intent.status = 'pending';
      const repository = JSON.parse(
        String(db.prepare('SELECT data FROM repositories').get()!.data),
      );
      delete repository.authority;
      db.prepare('UPDATE repositories SET data=? WHERE id=?').run(
        JSON.stringify(repository),
        repository.id,
      );
      db.prepare('UPDATE architecture_mutations SET data=? WHERE id=?').run(
        JSON.stringify(intent),
        intent.id,
      );
      if (!branchApplied) f.git('update-ref', '-d', intent.ref, intent.base);
      return intent;
    } finally {
      db.close();
    }
  }

  /** Recovers before/after branch publication without duplicating the interrupted configuration commit. */
  recovery(t: TestContext, branchApplied: boolean): void {
    const f = new PackageCliFixture(t);
    f.register();
    f.value(f.root, 'component', 'update', 'package', 'sample', 'purpose=Interrupted delivery');
    const intent = this.interrupt(f, branchApplied);
    const reader = new Portfolio(join(f.root, 'volume'));
    try {
      assert.throws(() => reader.packageTarget('package'), /Pending configuration transition/);
    } finally {
      reader.close();
    }
    f.value(f.root, 'package', 'update', 'package', 'purpose=Next delivery');
    const selected = f.value(f.root, 'package', 'get', 'package');
    assert.equal(f.git('rev-parse', selected.base + '^'), intent.base);
    assert.equal(
      f.value(f.root, 'component', 'get', 'package', 'sample').purpose,
      'Interrupted delivery',
    );
    const db = new DatabaseSync(join(f.root, 'volume/portfolio.sqlite'), { readOnly: true });
    try {
      const intents = db.prepare('SELECT data FROM architecture_mutations').all();
      assert.equal(intents.length, 2);
      assert.ok(intents.every((row) => JSON.parse(String(row.data)).status === 'completed'));
    } finally {
      db.close();
    }
  }

  /** Refuses unexpected configuration refs and source advances while retaining the original selection. */
  conflict(t: TestContext): void {
    const f = new PackageCliFixture(t);
    f.register();
    f.value(f.root, 'component', 'update', 'package', 'sample', 'purpose=Interrupted');
    const intent = this.interrupt(f, true);
    f.git('update-ref', intent.ref, intent.sourceBase);
    const blocked = f.command(f.root, 'package', 'update', 'package', 'purpose=Must not apply');
    assert.equal(blocked.status, 1);
    assert.match(blocked.stderr, /conflicts.*needs attention/);
    assert.equal(f.git('rev-parse', intent.ref), intent.sourceBase);
    f.git('update-ref', intent.ref, intent.base);
    f.value(f.root, 'package', 'update', 'package', 'purpose=Recovered');
    f.git('commit', '--allow-empty', '-m', 'External advancement');
    assert.match(f.command(f.root, 'package', 'get', 'package').stderr, /Source revision changed/);
  }
}

const scenarios = new ArchitectureUpdateScenarios();

test('architectural updates select shared committed authority without editing caller source', (t) =>
  scenarios.updates(t));

test('architectural updates reject invalid and foreign mutations atomically', (t) =>
  scenarios.rejects(t));

test('architectural updates enforce structured service revisions and execution targets', (t) =>
  scenarios.revisions(t));

test('architectural updates reject read-only and competing-host mutations', (t) =>
  scenarios.lease(t));

test('architectural updates reject symbolic refs without moving caller branches', (t) =>
  scenarios.symbolic(t));

test('architectural updates recover a journaled commit before its branch transition', (t) =>
  scenarios.recovery(t, false));

test('architectural updates recover a completed branch transition before database selection', (t) =>
  scenarios.recovery(t, true));

test('architectural updates retain conflicts and reject silent source advancement', (t) =>
  scenarios.conflict(t));

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
