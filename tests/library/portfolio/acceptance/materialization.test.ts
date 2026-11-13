import { setTimeout as delay } from 'node:timers/promises';
import { PortfolioStore } from '../../../../dist/library/coordination-store/portfolio-store.js';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { MinimalCatalogFixture } from '../../testing/support/minimal-catalog-fixture.js';

/** Exercises actual supervised Git materialization through the installed CLI contract. */
class MaterializationFixture extends MinimalCatalogFixture {
  volume = this.root + '-volume';

  readonly remote = pathToFileURL(this.root).href;

  /** Declares the real local remote and keeps disposable volume data separate from source. */
  constructor(t: TestContext) {
    super(t);
    t.after(() => rmSync(this.volume, { recursive: true, force: true }));
    this.put('.arc/architecture/environment.json', {
      schemaVersion: 5,
      workspace: { primary: { id: 'sample' }, dependencies: [] },
    });
    this.git('remote', 'set-url', 'origin', this.remote);
    this.git('add', '.');
    this.git('commit', '-qm', 'Declare local remote');
  }

  /** Runs from outside the checkout and preserves the public result and exit classification. */
  command(...args: string[]) {
    return spawnSync(process.execPath, [resolve('dist/cli.js'), ...args, '--json'], {
      cwd: '/tmp',
      encoding: 'utf8',
      env: {
        ...process.env,
        ARCNEXUS_VOLUME: this.volume,
        XDG_CONFIG_HOME: this.volume + '-config',
      },
    });
  }

  /** Starts the real CLI so a crash can be injected after its durable clone checkpoint. */
  start() {
    return spawn(
      process.execPath,
      [resolve('dist/cli.js'), 'platform', 'create', 'platform', this.remote, '--json'],
      {
        cwd: '/tmp',
        env: {
          ...process.env,
          ARCNEXUS_VOLUME: this.volume,
          XDG_CONFIG_HOME: this.volume + '-config',
        },
        stdio: ['ignore', 'ignore', 'ignore'],
      },
    );
  }

  /** Observes durable state without changing the process or fabricating a completed operation. */
  async ready() {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const store = new PortfolioStore(join(this.volume, 'portfolio.sqlite'));
      const entry = store.materializations()[0];
      store.close();
      if (entry?.status === 'ready') return entry;
      if (entry && entry.status !== 'pending')
        throw new Error('Missed clone checkpoint: ' + entry.status);
      await delay(5);
    }
    throw new Error('Test watchdog expired waiting for clone checkpoint');
  }

  /** Requires successful public execution before interpreting the returned resource. */
  value(...args: string[]): any {
    const result = this.command(...args);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }
}

const native = { skip: !process.env.ARCNEXUS_TEST_CODEX && 'Requires native process supervision' };

test(
  'remote materialization retains immutable source and survives volume relocation',
  native,
  (t) => {
    const f = new MaterializationFixture(t);
    const head = f.git('rev-parse', 'HEAD');
    const first = f.value('platform', 'create', 'platform', f.remote);
    assert.equal(first.managed, true);
    assert.equal(first.base, head);
    assert.ok(first.source.startsWith(join(f.volume, 'repositories')));
    assert.deepEqual(f.value('platform', 'create', 'platform', f.remote), first);
    assert.equal(readdirSync(join(f.volume, 'repositories')).length, 1);
    const moved = f.volume + '-moved';
    renameSync(f.volume, moved);
    f.volume = moved;
    const retained = f.value('platform', 'get', 'platform');
    assert.equal(retained.repositoryId, first.repositoryId);
    assert.equal(retained.revision, first.revision);
    assert.equal(retained.base, head);
    assert.equal(f.git('rev-parse', 'HEAD'), head);
    assert.equal(f.git('status', '--porcelain'), '');
  },
);

test('failed materialization retains evidence and cannot silently repeat Git', native, (t) => {
  const f = new MaterializationFixture(t);
  const missing = pathToFileURL(f.root + '-missing').href;
  const failed = f.command('platform', 'create', 'platform', missing);
  assert.equal(failed.status, 1, failed.stderr);
  const ids = readdirSync(join(f.volume, 'repositories'));
  assert.equal(ids.length, 1);
  const retried = f.command('platform', 'create', 'platform', missing);
  assert.equal(retried.status, 1);
  assert.match(retried.stderr, /reconcil/i);
  assert.deepEqual(readdirSync(join(f.volume, 'repositories')), ids);
  assert.deepEqual(f.value('platform', 'list').items, []);
});

test(
  'host loss after a recorded clone resumes registration without replaying the operation',
  native,
  async (t) => {
    const f = new MaterializationFixture(t);
    const child = f.start();
    t.after(() => child.kill('SIGKILL'));
    const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
    const entry = await f.ready();
    child.kill('SIGKILL');
    await closed;
    const log = join(f.volume, entry.evidence, 'result.json');
    const before = readFileSync(log, 'utf8');
    const resource = f.value('platform', 'create', 'platform', f.remote);
    assert.equal(resource.repositoryId, entry.id);
    assert.equal(readFileSync(log, 'utf8'), before);
    assert.equal(readdirSync(join(f.volume, 'repositories')).length, 1);
  },
);

test('corrected resource selection reuses a successful clone after invalid input', native, (t) => {
  const f = new MaterializationFixture(t);
  const wrong = f.command('platform', 'create', 'missing', f.remote);
  assert.equal(wrong.status, 2, wrong.stderr);
  const ids = readdirSync(join(f.volume, 'repositories'));
  const before = readFileSync(
    join(f.volume, 'repositories', ids[0]!, 'materialization/result.json'),
    'utf8',
  );
  const resource = f.value('platform', 'create', 'platform', f.remote);
  assert.equal(resource.repositoryId, ids[0]);
  assert.equal(
    readFileSync(join(f.volume, 'repositories', ids[0]!, 'materialization/result.json'), 'utf8'),
    before,
  );
});

test('ready clone recovery rejects changed source without repeating Git', native, (t) => {
  const f = new MaterializationFixture(t);
  assert.equal(f.command('platform', 'create', 'missing', f.remote).status, 2);
  const id = readdirSync(join(f.volume, 'repositories'))[0]!;
  const root = join(f.volume, 'repositories', id);
  const evidence = readFileSync(join(root, 'materialization/result.json'), 'utf8');
  writeFileSync(join(root, 'source/unreviewed.txt'), 'retained incomplete work');
  const result = f.command('platform', 'create', 'platform', f.remote);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /reconciliation/);
  assert.equal(readFileSync(join(root, 'materialization/result.json'), 'utf8'), evidence);
  assert.equal(
    readFileSync(join(root, 'source/unreviewed.txt'), 'utf8'),
    'retained incomplete work',
  );
  assert.deepEqual(f.value('platform', 'list').items, []);
});

test('remote transport rejects embedded credentials without persisting or echoing them', (t) => {
  const f = new MaterializationFixture(t);
  const result = f.command(
    'platform',
    'create',
    'platform',
    'https://user:secret@example.invalid/source.git',
  );
  assert.equal(result.status, 2);
  assert.doesNotMatch(result.stderr, /user:secret/);
  assert.equal(existsSync(join(f.volume, 'repositories')), false);
});

test('a declared upstream remains enforced for schema-five materialization', native, (t) => {
  const f = new MaterializationFixture(t);
  f.put('.arc/architecture/environment.json', {
    schemaVersion: 5,
    workspace: {
      primary: { id: 'sample', repository: 'https://example.invalid/different.git' },
      dependencies: [],
    },
  });
  f.git('add', '.');
  f.git('commit', '-qm', 'Explicit upstream constraint');
  const result = f.command('platform', 'create', 'platform', f.remote);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /origin identity mismatch/);
  assert.deepEqual(f.value('platform', 'list').items, []);
});

registerSuite({
  component: 'portfolio',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
