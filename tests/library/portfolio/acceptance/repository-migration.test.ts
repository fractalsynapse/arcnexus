import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { Portfolio } from '../../../../dist/library/portfolio/portfolio.js';
import { PortfolioStore } from '../../../../dist/library/coordination-store/portfolio-store.js';
import { ExecutionLease } from '../../../../dist/library/coordination-store/execution-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { MinimalCatalogFixture } from '../../testing/support/minimal-catalog-fixture.js';

/** Exercises migration through production services and CLI with disposable real local Git remotes. */
class MigrationFixture extends MinimalCatalogFixture {
  readonly volume = this.root + '-volume';

  readonly remote = pathToFileURL(this.root).href;

  /** Registers both resources on unchanged attached source before attempting transfer. */
  constructor(t: TestContext) {
    super(t);
    t.after(() => rmSync(this.volume, { recursive: true, force: true }));
    this.put('architecture/environment.json', {
      schemaVersion: 5,
      workspace: { primary: { id: 'sample' }, dependencies: [] },
    });
    this.git('add', '.');
    this.git('commit', '-qm', 'Use host repository binding');
    const service = this.service(t);
    service.register('platform', 'platform', this.root);
    service.register('package', 'platform/package', this.root);
  }

  /** Opens writable application services and closes them before fixture cleanup. */
  service(t: TestContext): Portfolio {
    const service = new Portfolio(this.volume, true);
    t.after(() => service.close());
    return service;
  }

  /** Executes the installed gateway outside any checkout with the same explicit managed volume. */
  command(...args: string[]) {
    return spawnSync(process.execPath, [resolve('dist/cli.js'), ...args, '--json'], {
      cwd: '/tmp',
      encoding: 'utf8',
      env: { ...process.env, ARCNEXUS_VOLUME: this.volume },
    });
  }

  /** Reads journal entries without creating additional execution or mutating receipts. */
  clones() {
    const store = new PortfolioStore(join(this.volume, 'portfolio.sqlite'));
    try {
      return store.materializations();
    } finally {
      store.close();
    }
  }
}

const native = { skip: !process.env.ARCNEXUS_TEST_CODEX && 'Requires native process supervision' };

test('stale migration and active repository lease fail before remote materialization', async (t) => {
  const f = new MigrationFixture(t);
  const service = f.service(t);
  await assert.rejects(
    service.migrateRepository(
      'platform',
      'platform',
      f.remote,
      new AbortController().signal,
      'stale',
    ),
    /revision changed/,
  );
  const lease = new ExecutionLease(join(f.root, '.git/arcnexus/host.lease.sqlite'));
  try {
    await assert.rejects(
      service.migrateRepository('platform', 'platform', f.remote, new AbortController().signal),
      /already owns/,
    );
  } finally {
    lease.close();
  }
  assert.deepEqual(f.clones(), []);
});

test(
  'migration transfers only selected resource and repeats without another clone or revision',
  native,
  (t) => {
    const f = new MigrationFixture(t);
    const before = f.service(t).get('platform', 'platform');
    const first = f.command('platform', 'migrate', 'platform', f.remote);
    assert.equal(first.status, 0, first.stderr);
    const migrated = JSON.parse(first.stdout);
    assert.notEqual(migrated.repositoryId, before.repositoryId);
    assert.equal(migrated.base, before.base);
    assert.equal(migrated.managed, true);
    assert.equal(f.service(t).get('package', 'package').repositoryId, before.repositoryId);
    const repeated = f.command('platform', 'migrate', 'platform', f.remote);
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.deepEqual(JSON.parse(repeated.stdout), migrated);
    const related = f.command('package', 'migrate', 'platform/package', f.remote);
    assert.equal(related.status, 0, related.stderr);
    assert.equal(JSON.parse(related.stdout).repositoryId, migrated.repositoryId);
    assert.equal(f.clones().length, 1);
    assert.equal(f.git('status', '--porcelain'), '');
    assert.equal(f.git('rev-parse', 'HEAD'), before.base);
  },
);

test('divergent remote retains failed selection and original source', native, (t) => {
  const f = new MigrationFixture(t);
  const foreign = new MinimalCatalogFixture(t);
  foreign.put('AGENTS.md', 'Different history\n');
  foreign.git('add', '.');
  foreign.git('commit', '-qm', 'Divergent source');
  const before = f.service(t).get('platform', 'platform');
  const result = f.command('platform', 'migrate', 'platform', foreign.root);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /reconcile repository history/);
  assert.deepEqual(f.service(t).get('platform', 'platform'), before);
  assert.equal(f.clones()[0]?.status, 'ready');
});

test('dirty retained destination blocks registration without discarding edits', native, (t) => {
  const f = new MigrationFixture(t);
  const result = f.command('platform', 'migrate', 'platform', f.remote);
  assert.equal(result.status, 0, result.stderr);
  const target = JSON.parse(result.stdout);
  const file = join(target.source, 'AGENTS.md');
  writeFileSync(file, 'Unfinished work\n');
  const before = f.service(t).get('package', 'package');
  const blocked = f.command('package', 'migrate', 'package', f.remote);
  assert.equal(blocked.status, 1, blocked.stderr);
  assert.match(blocked.stderr, /clone checkpoint/);
  assert.deepEqual(f.service(t).get('package', 'package'), before);
});

registerSuite({
  component: 'portfolio',
  level: 'acceptance',
  tags: ['native-host', 'deterministic', 'repository-migration'],
});
