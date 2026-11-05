import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Portfolio } from '../../../../dist/library/portfolio/portfolio.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { PackageCliFixture } from '../support/package-cli-fixture.js';

/** Exercises standard mutations through the built CLI and actual committed portfolio selection. */
class StandardFixture extends PackageCliFixture {
  /** Gives definitions and their documentation explicit owners without inventing document contents during CRUD. */
  constructor(t: TestContext) {
    super(t);
    this.extend('architecture/components/maintenance.yaml', (value) =>
      value.owns.push('architecture/standards'),
    );
    this.put('tests/standard.md', 'An explicitly authored engineering standard.');
    this.commit();
    this.register();
  }

  /** Creates a bounded standard with explicit intent and existing owned documentation. */
  create() {
    return this.value(
      this.root,
      'standard',
      'create',
      'platform',
      'quality',
      'owner=sample',
      'purpose=Readable engineering',
      'applicability=Maintained code',
      'document=tests/standard.md',
    );
  }
}

test('standard CRUD selects validated commits without changing the attached checkout', (t) => {
  const f = new StandardFixture(t);
  const head = f.git('rev-parse', 'HEAD');
  const created = f.create();
  assert.equal(created.id, 'quality');
  assert.deepEqual(created.operationIds, []);
  const updated = f.value(
    f.root,
    'standard',
    'update',
    'platform',
    'quality',
    'purpose=Clear engineering',
  );
  assert.equal(updated.purpose, 'Clear engineering');
  assert.notEqual(updated.revision, created.revision);
  assert.equal(f.value(f.root, 'standard', 'get', 'platform', 'quality').purpose, updated.purpose);
  assert.equal(f.value(f.root, 'standard', 'remove', 'platform', 'quality').removed, 'quality');
  assert.equal(f.value(f.root, 'standard', 'list', 'platform').items.length, 0);
  assert.equal(f.git('rev-parse', 'HEAD'), head);
  assert.equal(f.git('status', '--porcelain'), '');
});

test('invalid standard fields and references leave selected authority unchanged', (t) => {
  const f = new StandardFixture(t);
  f.create();
  const before = f.value(f.root, 'platform', 'get', 'platform');
  for (const patch of [
    'id=renamed',
    'schemaVersion=2',
    'owner=missing',
    'document=missing.md',
    'operationIds=["missing"]',
    'purpose=',
    'unknown=value',
  ]) {
    const result = f.command(f.root, 'standard', 'update', 'platform', 'quality', patch);
    assert.equal(result.status, 2, result.stderr);
  }
  assert.equal(
    f.command(f.root, 'standard', 'create', 'platform', 'quality', 'purpose=Duplicate').status,
    2,
  );
  assert.equal(f.command(f.root, 'standard', 'remove', 'platform', '../escape').status, 2);
  assert.deepEqual(f.value(f.root, 'platform', 'get', 'platform'), before);
});

test('standard mutation rejects stale revisions and removal of inherited references', (t) => {
  const f = new StandardFixture(t);
  const created = f.create();
  const service = new Portfolio(join(f.root, 'volume'), true);
  try {
    assert.throws(
      () => service.changeStandard('platform', 'quality', 'update', { purpose: 'Stale' }, 'stale'),
      /revision/,
    );
    service.changeStandard(
      'platform',
      'quality',
      'update',
      { purpose: 'Current' },
      created.revision,
    );
    assert.throws(
      () => service.changeStandard('platform', 'quality', 'remove', {}, created.revision),
      /revision/,
    );
    service.update('platform', 'platform', { standards: ['quality'] });
    const selected = service.get('platform', 'platform');
    assert.throws(() => service.changeStandard('platform', 'quality', 'remove'), /quality/);
    assert.equal(service.get('platform', 'platform').base, selected.base);
  } finally {
    service.close();
  }
});

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic', 'portfolio'] });
