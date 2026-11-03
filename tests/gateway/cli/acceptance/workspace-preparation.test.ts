import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { PackageCliFixture } from '../support/package-cli-fixture.js';
import { ExecutionLease } from '../../../../dist/library/coordination-store/execution-store.js';
import { WorkspacePreparation } from '../../../../dist/library/workspace/workspace.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises registered preparation through the production CLI and captured setup operations. */
class WorkspacePreparationScenarios {
  /** A prepared receipt captures package membership and leaves the attached checkout untouched. */
  prepared(f: PackageCliFixture): void {
    f.register();
    const base = f.git('rev-parse', 'HEAD');
    const result = f.value(f.root, 'workspace', 'prepare', 'platform/package');
    assert.equal(result.workspace.status, 'prepared');
    assert.equal(result.workspace.packageId, 'package');
    assert.equal(result.workspace.base, base);
    assert.equal(result.finalized, true);
    assert.equal(f.git('status', '--porcelain'), '');
    assert.equal(f.git('rev-parse', 'HEAD'), base);
    assert.equal(f.value(f.root, 'workspace', 'list', 'package').items.length, 1);
    assert.equal(
      f.value(f.root, 'workspace', 'get', result.workspace.id).revision,
      result.revision,
    );
  }

  /** Canonical repository ownership prevents preparation before a worktree or receipt is created. */
  leased(f: PackageCliFixture): void {
    f.register();
    const common = f.git('rev-parse', '--path-format=absolute', '--git-common-dir');
    const lease = new ExecutionLease(join(common, 'arcnexus', 'host.lease.sqlite'));
    try {
      const result = f.command(f.root, 'workspace', 'prepare', 'package');
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /owns project execution/);
      assert.equal(existsSync(join(f.root, 'state', 'runs')), false);
    } finally {
      lease.close();
    }
  }

  /** Declared setup uses real confinement, and failures keep their operation log and receipt. */
  setup(f: PackageCliFixture, fail: boolean): void {
    f.operation('setup', [
      '-e',
      fail
        ? 'console.error("setup failed");process.exit(4)'
        : 'require("fs").writeFileSync(".test-build/prepared","ok")',
    ]);
    f.extend(
      'architecture/components/package.yaml',
      (value) => (value.operations = { setup: ['setup'] }),
    );
    f.commit();
    f.register();
    const result = f.command(f.root, 'workspace', 'prepare', 'package');
    assert.equal(result.status, fail ? 1 : 0, result.stderr);
    const view = JSON.parse(result.stdout);
    assert.equal(view.workspace.status, fail ? 'failed' : 'prepared');
    const record = JSON.parse(
      readFileSync(join(f.root, 'state', 'runs', view.workspace.id, 'report.json'), 'utf8'),
    );
    assert.equal(record.operationInvocations.length, 1);
    assert.ok(existsSync(record.operationInvocations[0].result.log));
    assert.equal(existsSync(view.workspace.location), true);
    assert.equal(f.git('status', '--porcelain'), '');
    if (!fail)
      assert.equal(
        readFileSync(join(view.workspace.location, '.test-build/prepared'), 'utf8'),
        'ok',
      );
  }
}

const scenarios = new WorkspacePreparationScenarios();

test('registered workspace preparation works outside a checkout without setup', (t) =>
  scenarios.prepared(new PackageCliFixture(t)));

test('workspace preparation refuses an existing canonical repository lease', (t) =>
  scenarios.leased(new PackageCliFixture(t)));

test('workspace preparation rejects invalid targeting and irrelevant execution options', (t) => {
  const f = new PackageCliFixture(t);
  for (const args of [[], ['unknown'], ['package', 'extra'], ['package', '--model', 'override']])
    assert.equal(f.command(f.root, 'workspace', 'prepare', ...args).status, 2);
  assert.equal(existsSync(join(f.root, 'state')), false);
});

for (const fail of [false, true])
  test(
    'registered workspace retains actual setup ' + (fail ? 'failure evidence' : 'outputs'),
    { skip: !process.env.ARCNEXUS_TEST_CODEX && 'Requires installed confinement' },
    (t) => scenarios.setup(new PackageCliFixture(t), fail),
  );

test('workspace preparation rejects dirty source without a worktree', (t) => {
  const f = new PackageCliFixture(t);
  f.register();
  writeFileSync(join(f.repo, 'untracked.txt'), 'unfinished caller work');
  const result = f.command(f.root, 'workspace', 'prepare', 'package');
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /clean/);
  assert.equal(f.git('worktree', 'list', '--porcelain').split('worktree ').length, 2);
});

test('shared preparation returns a resource and releases its lease without a CLI process exit', async (t) => {
  const f = new PackageCliFixture(t);
  const target = { source: f.repo, base: f.git('rev-parse', 'HEAD'), packageId: 'package' };
  const root = join(f.root, 'direct-state');
  const service = new WorkspacePreparation(root);
  const result = await service.prepare(target, new AbortController().signal);
  assert.equal(result.workspace.status, 'prepared');
  const common = f.git('rev-parse', '--path-format=absolute', '--git-common-dir');
  new ExecutionLease(join(common, 'arcnexus', 'host.lease.sqlite')).close();
  const controller = new AbortController();
  controller.abort(new Error('cancelled before preparation'));
  await assert.rejects(service.prepare(target, controller.signal), /cancelled before preparation/);
});

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic', 'native-host'] });
