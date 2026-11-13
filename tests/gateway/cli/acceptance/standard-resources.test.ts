import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { PackageCliFixture } from '../support/package-cli-fixture.js';

/** Exercises standard queries through registered repositories and the assembled CLI. */
class StandardCommandScenarios {
  /** Registers complete source before probing commands, so bad setup cannot mimic missing behavior. */
  private fixture(t: TestContext): PackageCliFixture {
    const f = new PackageCliFixture(t);
    f.extend('.arc/architecture/components/maintenance.yaml', (v) =>
      v.owns.push('.arc/architecture/standards'),
    );
    f.put('tests/examples/guide.md', 'Keep code readable.');
    f.put('.arc/architecture/standards/readable.yaml', {
      schemaVersion: 1,
      id: 'readable',
      owner: 'sample',
      purpose: 'Readable code',
      applicability: 'Owned code',
      document: 'tests/examples/guide.md',
      examples: [],
      operationIds: [],
    });
    f.commit();
    f.register();
    return f;
  }

  /** Reads unused standards outside the source checkout without execution state or source writes. */
  reads(t: TestContext): void {
    const f = this.fixture(t);
    const page = f.value(
      f.root,
      'standard',
      'list',
      'platform',
      'owner=sample',
      '--search',
      'READABLE',
    );
    assert.equal(page.items.length, 1);
    const item = f.value(f.root, 'standard', 'get', 'platform', 'readable');
    assert.equal(item.document, 'tests/examples/guide.md');
    assert.match(item.revision, /^[a-f0-9]{64}$/);
    assert.equal(existsSync(join(f.root, 'state')), false);
    assert.equal(f.git('status', '--porcelain'), '');
  }

  /** Reports invalid unused guidance as preflight input failure rather than an execution failure. */
  malformed(t: TestContext): void {
    const f = this.fixture(t);
    f.extend('.arc/architecture/standards/readable.yaml', (v) => v.operationIds.push('undeclared'));
    f.commit();
    const result = f.command(f.root, 'standard', 'list', 'platform');
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /outside owner's operations/);
  }

  /** Rejects irrelevant options, malformed filters and missing resources using shared invalid-input codes. */
  rejects(t: TestContext): void {
    const f = this.fixture(t);
    for (const args of [
      ['list', 'platform', 'secret=x'],
      ['list', 'platform', '--limit', '101'],
      ['list', 'missing'],
      ['get', 'platform', 'missing'],
      ['get', 'platform', 'readable', '--search', 'x'],
      ['get', 'platform'],
      ['list', 'platform', '--model', 'override'],
    ])
      assert.equal(f.command(f.root, 'standard', ...args).status, 2, args.join(' '));
    assert.equal(existsSync(join(f.root, 'state')), false);
    assert.equal(f.git('status', '--porcelain'), '');
  }
}

const scenarios = new StandardCommandScenarios();

test('standard CLI reads unused platform guidance outside its checkout', (t) => scenarios.reads(t));

test('standard CLI rejects invalid requests without execution side effects', (t) =>
  scenarios.rejects(t));

test('standard CLI reports malformed guidance as invalid input', (t) => scenarios.malformed(t));

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
