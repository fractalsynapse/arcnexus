import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PackageCliFixture } from '../support/package-cli-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

test('portfolio lists share search and revision-bound pagination without changing registration', (t) => {
  const f = new PackageCliFixture(t);
  f.register();
  f.value(f.root, 'package', 'create', 'platform/maintenance-package', f.repo);
  const first = f.value(f.root, 'package', 'list', 'platform', '--limit', '1');
  const next = f.value(
    f.root,
    'package',
    'list',
    'platform',
    '--limit',
    '1',
    '--cursor',
    first.nextCursor,
  );
  assert.equal(first.items.length, 1);
  assert.equal(next.items.length, 1);
  assert.notEqual(first.items[0].id, next.items[0].id);
  assert.equal(next.nextCursor, null);
  const found = f.value(f.root, 'package', 'list', '--search', 'MAINTENANCE');
  assert.deepEqual(
    found.items.map((item: any) => item.id),
    ['platform/maintenance-package'],
  );
  assert.equal(f.command(f.root, 'package', 'list', '--limit', '0').status, 2);
  assert.equal(f.git('status', '--porcelain'), '');
});

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
