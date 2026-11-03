import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { PackageCliFixture } from '../support/package-cli-fixture.js';

/** Exercises component commands against real registered repositories outside their checkout. */
class ComponentCommandScenarios {
  /** Lists the package itself, queries descendants and reads revision-bound intent without a host. */
  reads(t: TestContext): void {
    const f = new PackageCliFixture(t);
    f.register();
    const page = f.value(f.root, 'component', 'list', 'platform/package');
    assert.deepEqual(
      page.items.map((x: any) => x.id),
      ['package', 'sample'],
    );
    const filtered = f.value(
      f.root,
      'component',
      'list',
      'package',
      'type=library',
      '--search',
      'SAMPLE',
    );
    assert.deepEqual(
      filtered.items.map((x: any) => x.id),
      ['sample'],
    );
    this.pages(f);
    const component = f.value(f.root, 'component', 'get', 'package', 'sample');
    assert.equal(component.purpose, 'Own test selection');
    assert.match(component.revision, /^[a-f0-9]{64}$/);
    assert.equal(existsSync(join(f.root, 'state')), false);
    assert.equal(f.git('status', '--porcelain'), '');
  }

  /** Follows a cursor through the actual CLI without changing query parameters. */
  private pages(f: PackageCliFixture): void {
    const first = f.value(f.root, 'component', 'list', 'package', '--limit', '1');
    const second = f.value(
      f.root,
      'component',
      'list',
      'package',
      '--limit',
      '1',
      '--cursor',
      first.nextCursor,
    );
    assert.equal(second.items[0].id, 'sample');
  }

  /** Rejects invalid requests and foreign components before engineering or writable state initialization. */
  rejects(t: TestContext): void {
    const f = new PackageCliFixture(t);
    const absent = f.command(f.root, 'component', 'list', 'unknown');
    assert.equal(absent.status, 2);
    assert.equal(existsSync(join(f.root, 'volume')), false);
    f.register();
    for (const args of [
      ['list', 'package', 'type=invalid'],
      ['list', 'package', 'secret=x'],
      ['list', 'package', '--cursor', 'bad'],
      ['list', 'package', '--limit', '101'],
      ['get', 'package', 'missing'],
      ['get', 'package', 'maintenance'],
      ['get', 'package', 'sample', '--search', 'sample'],
      ['list', 'package', '--model', 'override'],
      ['get', 'package'],
      ['get', 'package', 'sample', 'extra'],
    ])
      assert.equal(f.command(f.root, 'component', ...args).status, 2, args.join(' '));
    assert.equal(existsSync(join(f.root, 'state')), false);
    assert.equal(f.git('status', '--porcelain'), '');
  }

  /** Keeps short-name ambiguity explicit while qualified package references remain usable. */
  ambiguous(t: TestContext): void {
    const f = new PackageCliFixture(t);
    f.register();
    const other = new PackageCliFixture(t);
    other.extend('architecture/components/platform.yaml', (v) => {
      v.id = 'other';
    });
    for (const name of ['package', 'maintenance-package'])
      other.extend(`architecture/components/${name}.yaml`, (v) => {
        v.parentId = 'other';
      });
    other.commit();
    f.value(f.root, 'platform', 'create', 'other', other.repo);
    f.value(f.root, 'package', 'create', 'other/package', other.repo);
    const result = f.command(f.root, 'component', 'list', 'package');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /unknown or ambiguous/i);
    assert.equal(f.value(f.root, 'component', 'get', 'other/package', 'sample').id, 'sample');
  }
}

const scenarios = new ComponentCommandScenarios();

test('component resource CLI reads registered targets without execution side effects', (t) =>
  scenarios.reads(t));

test('component resource CLI rejects invalid inputs and out-of-scope reads', (t) =>
  scenarios.rejects(t));

test('component resource CLI requires qualification for ambiguous package names', (t) =>
  scenarios.ambiguous(t));

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
