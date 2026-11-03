import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { PackageCliFixture } from '../support/package-cli-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises volume selection without the legacy override used by older CLI fixtures. */
class VolumeStateFixture extends PackageCliFixture {
  readonly processEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    ARCNEXUS_VOLUME: join(this.root, 'volume'),
    ARCNEXUS_STATE_DIR: undefined,
    XDG_STATE_HOME: join(this.root, 'historical'),
    XDG_DATA_HOME: join(this.root, 'data'),
    XDG_CONFIG_HOME: join(this.root, 'configuration'),
  };

  /** Runs the assembled CLI with isolated settings and no implicit caller state selection. */
  override command(cwd: string, ...args: string[]) {
    return spawnSync(process.execPath, [resolve('dist/cli.js'), ...args, '--json'], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: this.processEnvironment,
    });
  }

  /** Confirms preparation and subsequent reads select the same root without changing source. */
  prepared(root: string): void {
    this.register();
    const result = this.value(this.root, 'workspace', 'prepare', 'package');
    const id = result.workspace.id;
    assert.equal(result.workspace.status, 'prepared');
    assert.ok(existsSync(join(root, 'runs', id, 'report.json')));
    assert.equal(this.value(this.root, 'workspace', 'get', id).revision, result.revision);
    assert.equal(this.value(this.root, 'workspace', 'list').items.length, 1);
    assert.equal(this.git('status', '--porcelain'), '');
  }
}

for (const selection of ['environment', 'configuration', 'default'])
  test('workspace state follows ' + selection + ' volume selection outside a checkout', (t) => {
    const f = new VolumeStateFixture(t);
    let volume = join(f.root, 'volume');
    if (selection !== 'environment') {
      delete f.processEnvironment.ARCNEXUS_VOLUME;
      volume = join(f.root, selection === 'default' ? 'data/arcnexus' : 'configured');
      if (selection === 'configuration') f.value(f.root, 'config', 'update', 'volume', volume);
    }
    for (const resource of ['workspace', 'task', 'workday'])
      assert.deepEqual(f.value(f.root, resource, 'list').items, []);
    assert.equal(existsSync(volume), false);
    f.prepared(join(volume, 'state'));
    assert.equal(existsSync(join(f.root, 'historical')), false);
  });

test('explicit historical state stays readable without copying evidence into the volume', (t) => {
  const f = new VolumeStateFixture(t);
  const historical = join(f.root, 'historical/arcnexus');
  f.processEnvironment.ARCNEXUS_STATE_DIR = historical;
  f.prepared(historical);
  delete f.processEnvironment.ARCNEXUS_STATE_DIR;
  assert.deepEqual(f.value(f.root, 'workspace', 'list').items, []);
  assert.equal(existsSync(join(f.root, 'volume/state')), false);
  f.processEnvironment.ARCNEXUS_STATE_DIR = historical;
  assert.equal(f.value(f.root, 'workspace', 'list').items.length, 1);
});

for (const variable of ['ARCNEXUS_VOLUME', 'ARCNEXUS_STATE_DIR'])
  test('empty ' + variable + ' fails without selecting the current directory', (t) => {
    const f = new VolumeStateFixture(t);
    f.processEnvironment[variable] = ' ';
    assert.equal(f.command(f.root, 'workspace', 'list').status, 2);
    assert.equal(existsSync(join(f.root, 'volume')), false);
  });

for (const location of ['volume/state', 'historical/arcnexus', 'explicit'])
  test('unregistration retains active execution in ' + location, (t) => {
    const f = new VolumeStateFixture(t);
    f.register();
    f.processEnvironment.ARCNEXUS_STATE_DIR = join(f.root, 'explicit');
    const common = f.git('rev-parse', '--path-format=absolute', '--git-common-dir');
    const key = createHash('sha256').update(common).digest('hex').slice(0, 24);
    const directory = join(f.root, location, 'projects', key);
    mkdirSync(directory, { recursive: true });
    const store = new ExecutionStore(join(directory, 'execution.sqlite'));
    try {
      store.createRun('workday', ['owner'], 'Retain unfinished execution');
    } finally {
      store.close();
    }
    const result = f.command(f.root, 'package', 'remove', 'package');
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /active repository execution/);
    assert.equal(f.value(f.root, 'package', 'get', 'package').id, 'platform/package');
  });

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
