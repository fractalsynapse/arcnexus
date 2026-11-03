import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { waitFor } from '../../../library/testing/support/test-process.js';
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

  /** Cancellation retains the unfinished receipt and releases repository ownership after child cleanup. */
  async cancelled(f: PackageCliFixture): Promise<void> {
    this.declareSetup(f, [
      '-e',
      'require("fs").writeFileSync(".test-build/ready","ok");setInterval(()=>{},1000)',
    ]);
    const root = join(f.root, 'cancel-state'),
      controller = new AbortController();
    const target = { source: f.repo, base: f.git('rev-parse', 'HEAD'), packageId: 'package' };
    const pending = new WorkspacePreparation(root).prepare(target, controller.signal);
    try {
      await waitFor(
        () =>
          readdirSync(join(root, 'workspaces')).some((id) =>
            existsSync(join(root, 'workspaces', id, '.test-build/ready')),
          ),
        'Setup must start',
        60_000,
      );
      controller.abort(new Error('qualification cancellation'));
      const result = await pending;
      this.cancelledEvidence(f, root, result);
    } finally {
      controller.abort();
      await pending;
    }
  }

  /** Captures a shared setup recipe and its package usage before execution. */
  private declareSetup(f: PackageCliFixture, args: string[]): void {
    f.operation('setup', args);
    f.extend(
      'architecture/components/package.yaml',
      (value) => (value.operations = { setup: ['setup'] }),
    );
    f.commit();
  }

  /** Checks retained cancellation evidence, kernel scope removal and same-process lease reacquisition. */
  private cancelledEvidence(f: PackageCliFixture, root: string, result: any): void {
    assert.equal(result.workspace.status, 'cancelled');
    assert.equal(result.finalized, true);
    const record = JSON.parse(
      readFileSync(join(root, 'runs', result.workspace.id, 'report.json'), 'utf8'),
    );
    const scope = record.operationInvocations[0].result.processScope;
    assert.equal(typeof scope, 'string');
    assert.equal(existsSync(scope), false);
    const common = f.git('rev-parse', '--path-format=absolute', '--git-common-dir');
    new ExecutionLease(join(common, 'arcnexus', 'host.lease.sqlite')).close();
  }

  /** Declared setup uses real confinement, and failures keep their operation log and receipt. */
  setup(f: PackageCliFixture, fail: boolean): void {
    this.declareSetup(f, [
      '-e',
      fail
        ? 'console.error("setup failed");process.exit(4)'
        : 'require("fs").writeFileSync(".test-build/prepared","ok")',
    ]);
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
  await assert.rejects(
    new WorkspacePreparation(root).prepare(
      { ...target, packageId: '' },
      new AbortController().signal,
    ),
    /identity are required/,
  );
  assert.equal(existsSync(root), false);
  const service = new WorkspacePreparation(root);
  const result = await service.prepare(target, new AbortController().signal);
  assert.equal(result.workspace.status, 'prepared');
  const common = f.git('rev-parse', '--path-format=absolute', '--git-common-dir');
  new ExecutionLease(join(common, 'arcnexus', 'host.lease.sqlite')).close();
  const controller = new AbortController();
  controller.abort(new Error('cancelled before preparation'));
  await assert.rejects(service.prepare(target, controller.signal), /cancelled before preparation/);
});

test(
  'shared workspace preparation cancels managed setup and releases its lease',
  { skip: !process.env.ARCNEXUS_TEST_CODEX && 'Requires installed confinement' },
  (t) => scenarios.cancelled(new PackageCliFixture(t)),
);

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic', 'native-host'] });
