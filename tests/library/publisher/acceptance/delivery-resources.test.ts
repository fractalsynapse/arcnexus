import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { DeliveryStore } from '../../../../dist/library/coordination-store/delivery-store.js';
import { DeliveryResources } from '../../../../dist/library/publisher/publisher.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Supplies explicit retained evidence to test resource projection without pretending to verify engineering. */
class ResourceFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-delivery-resource-'));

  readonly store = new DeliveryStore(join(this.root, 'projects/project/deliveries.sqlite'));

  readonly resources = new DeliveryResources(this.root);

  /** Captures controlled metadata and closes all state before removing temporary evidence. */
  constructor(t: TestContext) {
    t.after(() => {
      this.store.close();
      rmSync(this.root, { recursive: true, force: true });
    });
    this.store.capture({
      id: 'delivery',
      projectId: 'project',
      packageId: 'package',
      runId: 'run',
      assignmentIds: ['assignment'],
      environment: { id: 'simulation', mode: 'simulation' },
      authorityDigest: 'controlled-authority',
      base: 'base',
      candidate: 'candidate',
      verification: { references: ['controlled-evidence'], digest: 'controlled-digest' },
      target: { repository: 'controlled/repository', branch: 'staging' },
    });
  }

  /** Executes the built CLI outside any checkout using only configured application storage. */
  cli(...args: string[]) {
    return JSON.parse(
      execFileSync(process.execPath, [resolve('dist/cli.js'), 'delivery', ...args, '--json'], {
        cwd: tmpdir(),
        env: { ...process.env, ARCNEXUS_STATE_DIR: this.root },
        encoding: 'utf8',
      }),
    );
  }
}

test('delivery resources preserve exact-revision approval without claiming provider review or publication', (t) => {
  const f = new ResourceFixture(t);
  const initial = f.resources.get('delivery');
  assert.equal(f.resources.list({ filters: ['mode=simulation'] }).items.length, 1);
  assert.equal(f.resources.list({ filters: ['mode=live'] }).items.length, 0);
  const approved = f.resources.approve('delivery', initial.revision);
  assert.equal(approved.approval!.candidate, initial.candidate);
  assert.notEqual(approved.revision, initial.revision);
  assert.equal(approved.integration, 'not_requested');
  assert.equal(approved.publication, 'not_requested');
  assert.throws(() => f.resources.approve('delivery', initial.revision), /Stale/);
  assert.throws(() => f.resources.list({ filters: ['unknown=value'] }), /Unknown/);
});

test('built delivery CLI lists reads and approves retained revisions outside a checkout', (t) => {
  const f = new ResourceFixture(t);
  assert.equal(f.cli('list').items[0].id, 'delivery');
  assert.equal(f.cli('get', 'delivery').environment.mode, 'simulation');
  assert.equal(f.cli('approve', 'delivery').approval.candidate, 'candidate');
  const invalid = spawnSync(
    process.execPath,
    [resolve('dist/cli.js'), 'delivery', 'approve', 'delivery', '--simulate'],
    {
      cwd: tmpdir(),
      env: { ...process.env, ARCNEXUS_STATE_DIR: f.root },
      encoding: 'utf8',
    },
  );
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /delivery|simulate|Simulation/);
});

registerSuite({
  component: 'publisher',
  level: 'acceptance',
  tags: ['deterministic', 'lifecycle-effects'],
});
