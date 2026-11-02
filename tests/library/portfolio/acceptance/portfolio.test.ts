import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Portfolio } from '../../../../dist/library/portfolio/portfolio.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { MinimalCatalogFixture } from '../../testing/support/minimal-catalog-fixture.js';

/** Runs the public portfolio interface from outside any checkout with private persistent storage. */
class PortfolioFixture extends MinimalCatalogFixture {
  readonly volume = this.root + '-volume';

  /** Retains source and volume separately so registration cannot pollute maintained source. */
  constructor(t: TestContext) {
    super(t);
    t.after(() => rmSync(this.volume, { recursive: true, force: true }));
  }

  /** Changes declared platform identity while preserving inherited policies for ambiguity coverage. */
  platform(id: string): void {
    for (const name of ['platform', 'package']) {
      const path = 'architecture/components/' + name + '.json';
      const value = JSON.parse(readFileSync(join(this.root, path), 'utf8'));
      if (name === 'platform') value.id = id;
      else value.parentId = id;
      this.put(path, value);
    }
    this.git('add', '.');
    this.git('commit', '-qm', 'Distinct platform');
  }

  /** Captures complete CLI output without injecting a substitute registry implementation. */
  command(...args: string[]) {
    return spawnSync(process.execPath, [resolve('dist/cli.js'), ...args, '--json'], {
      cwd: tmpdir(),
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        ARCNEXUS_VOLUME: this.volume,
        XDG_CONFIG_HOME: join(this.volume, 'configuration'),
      },
    });
  }

  /** Requires successful public execution before decoding its resource result. */
  value(...args: string[]): any {
    const result = this.command(...args);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }
}

test('portfolio reads outside a checkout do not initialize storage or execution', (t) => {
  const f = new PortfolioFixture(t);
  assert.deepEqual(f.value('platform', 'list').items, []);
  assert.equal(existsSync(f.volume), false);
  assert.equal(f.value('config', 'get', 'volume').value, f.volume);
});

test('platform and package registration share repository identity and retain source on removal', (t) => {
  const f = new PortfolioFixture(t);
  const before = f.git('rev-parse', 'HEAD');
  const platform = f.value('platform', 'create', 'platform', f.root);
  const pkg = f.value('package', 'create', 'platform/package', f.root);
  assert.equal(platform.repositoryId, pkg.repositoryId);
  assert.equal(f.value('package', 'get', 'package').id, 'platform/package');
  assert.equal(f.value('package', 'list', 'platform').items.length, 1);
  assert.equal(f.command('platform', 'remove', 'platform').status, 1);
  f.value('package', 'remove', 'platform/package');
  f.value('platform', 'remove', 'platform');
  assert.deepEqual(f.value('platform', 'list').items, []);
  assert.equal(f.git('rev-parse', 'HEAD'), before);
  assert.equal(f.git('status', '--porcelain'), '');
});

test('registration is idempotent and stale removal retains the resource', (t) => {
  const f = new PortfolioFixture(t);
  const original = f.value('platform', 'create', 'platform', f.root);
  const repeated = f.value('platform', 'create', 'platform', f.root);
  assert.deepEqual(repeated, original);
  const service = new Portfolio(f.volume, true);
  try {
    assert.throws(() => service.remove('platform', 'platform', 'stale'), /revision changed/);
    assert.equal(service.get('platform', 'platform').revision, original.revision);
    service.remove('platform', 'platform', original.revision);
    assert.deepEqual(service.list('platform').items, []);
  } finally {
    service.close();
  }
});

test('invalid identities and unknown resources fail without registering partial resources', (t) => {
  const f = new PortfolioFixture(t);
  assert.equal(f.command('platform', 'create', '../platform', f.root).status, 2);
  assert.equal(f.command('package', 'create', 'other/package', f.root).status, 2);
  assert.equal(f.command('platform', 'get', 'missing').status, 2);
  assert.deepEqual(f.value('platform', 'list').items, []);
  assert.deepEqual(f.value('package', 'list').items, []);
});

test('short package references reject ambiguity while qualified references remain stable', (t) => {
  const first = new PortfolioFixture(t);
  const second = new PortfolioFixture(t);
  second.platform('second');
  first.value('platform', 'create', 'platform', first.root);
  first.value('package', 'create', 'platform/package', first.root);
  first.value('platform', 'create', 'second', second.root);
  first.value('package', 'create', 'second/package', second.root);
  assert.equal(first.command('package', 'get', 'package').status, 2);
  assert.equal(first.value('package', 'get', 'second/package').source, second.root);
  assert.equal(first.value('package', 'list').items.length, 2);
});

test('relocating the volume preserves registered identity and attached repository paths', (t) => {
  const f = new PortfolioFixture(t);
  const resource = f.value('platform', 'create', 'platform', f.root);
  const destination = f.volume + '-relocated';
  t.after(() => rmSync(destination, { recursive: true, force: true }));
  renameSync(f.volume, destination);
  const service = new Portfolio(destination);
  try {
    assert.deepEqual(service.get('platform', 'platform'), resource);
  } finally {
    service.close();
  }
});

test('registered package validation runs outside the source checkout without starting execution', (t) => {
  const f = new PortfolioFixture(t);
  f.value('platform', 'create', 'platform', f.root);
  f.value('package', 'create', 'platform/package', f.root);
  const result = f.value('validate', 'platform/package');
  assert.equal(result.status, 'valid');
  assert.equal(result.guidance.status, 'valid');
  assert.equal(result.base, f.git('rev-parse', 'HEAD'));
  assert.equal(existsSync(join(f.volume, 'state')), false);
  assert.equal(f.command('validate', 'platform/package', '--project', f.root).status, 2);
});

test('application settings persist only allowlisted fields and expose environment precedence', (t) => {
  const f = new PortfolioFixture(t);
  const configured = f.volume + '-configured';
  const result = f.value('config', 'update', 'volume', configured);
  assert.equal(result.configuredValue, configured);
  assert.equal(result.source, 'environment');
  assert.equal(result.value, f.volume);
  assert.equal(f.command('config', 'update', 'purpose', 'Unapproved intent').status, 2);
  assert.equal(f.value('config', 'get', 'volume').value, f.volume);
  const saved = JSON.parse(
    readFileSync(join(f.volume, 'configuration/arcnexus/config.json'), 'utf8'),
  );
  assert.deepEqual(saved, { volume: configured });
});

test('malformed application settings fail preflight without replacing the configuration', (t) => {
  const f = new PortfolioFixture(t);
  f.value('config', 'update', 'volume', f.volume);
  const path = join(f.volume, 'configuration/arcnexus/config.json');
  writeFileSync(path, '{invalid');
  assert.equal(f.command('config', 'get', 'volume').status, 2);
  assert.equal(f.command('config', 'update', 'volume', f.volume).status, 2);
  assert.equal(readFileSync(path, 'utf8'), '{invalid');
});

registerSuite({ component: 'portfolio', level: 'acceptance', tags: ['deterministic'] });
