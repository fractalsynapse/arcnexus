import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { PackageCliFixture } from '../support/package-cli-fixture.js';
import { ExecutionLease } from '../../../../dist/library/coordination-store/execution-store.js';
import { WorkspaceDisposal } from '../../../../dist/library/workspace/workspace.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises package-scoped cleanup against real managed Git worktrees and retained reports. */
class CleanupFixture extends PackageCliFixture {
  /** Creates a finalized disposable workspace through the production preparation service. */
  prepare() {
    this.register();
    return this.value(this.root, 'workspace', 'prepare', 'package').workspace;
  }

  /** Locates the original receipt so cleanup can prove preservation independently of projections. */
  report(id: string): string {
    return join(this.root, 'state/runs', id, 'report.json');
  }

  /** Records explicit retained-state fixtures without substituting the cleanup implementation. */
  retain(id: string, incomplete: boolean): void {
    const path = this.report(id),
      record = JSON.parse(readFileSync(path, 'utf8'));
    if (incomplete) delete record.finishedAt;
    else record.assignmentId = 'retained-assignment';
    writeFileSync(path, JSON.stringify(record));
  }
}

test('package cleanup removes only the selected workspace and preserves its original evidence', (t) => {
  const f = new CleanupFixture(t),
    first = f.prepare(),
    second = f.prepare();
  const before = readFileSync(f.report(first.id), 'utf8');
  const result = f.value(f.root, 'workspace', 'cleanup', 'package', '--workspace', first.id);
  assert.equal(result.status, 'completed');
  assert.equal(result.items[0].status, 'removed');
  assert.equal(existsSync(first.location), false);
  assert.equal(existsSync(second.location), true);
  assert.equal(readFileSync(f.report(first.id), 'utf8'), before);
  assert.equal(f.value(f.root, 'workspace', 'get', first.id).workspace.status, 'removed');
  assert.equal(f.value(f.root, 'workspace', 'cleanup', 'package').status, 'completed');
  assert.equal(existsSync(second.location), false);
  assert.equal(f.value(f.root, 'workspace', 'cleanup', 'package').status, 'completed');
  assert.equal(f.git('status', '--porcelain'), '');
});

test('package cleanup rejects wrong-package and unknown identities without deleting work', (t) => {
  const f = new CleanupFixture(t),
    workspace = f.prepare();
  f.value(f.root, 'package', 'create', 'platform/maintenance-package', f.repo);
  for (const [pkg, id] of [
    ['maintenance-package', workspace.id],
    ['package', 'unknown'],
  ]) {
    const result = f.command(f.root, 'workspace', 'cleanup', pkg!, '--workspace', id!);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(existsSync(workspace.location), true);
  }
});

for (const incomplete of [false, true])
  test('package cleanup preserves ' + (incomplete ? 'unfinished' : 'retained') + ' work', (t) => {
    const f = new CleanupFixture(t),
      workspace = f.prepare();
    f.retain(workspace.id, incomplete);
    const result = f.command(f.root, 'workspace', 'cleanup', 'package');
    assert.equal(result.status, 1, result.stderr);
    const view = JSON.parse(result.stdout);
    assert.equal(view.status, 'partial');
    assert.equal(view.items[0].status, 'preserved');
    assert.equal(existsSync(workspace.location), true);
  });

test('package cleanup preserves edits while still removing unrelated eligible workspaces', (t) => {
  const f = new CleanupFixture(t),
    dirty = f.prepare(),
    clean = f.prepare();
  writeFileSync(join(dirty.location, 'unfinished.txt'), 'Keep this work');
  const result = f.command(f.root, 'workspace', 'cleanup', 'package');
  assert.equal(result.status, 1, result.stderr);
  const view = JSON.parse(result.stdout);
  assert.equal(view.items.find((item: any) => item.id === dirty.id).status, 'preserved');
  assert.equal(existsSync(dirty.location), true);
  assert.equal(existsSync(clean.location), false);
});

test('package cleanup refuses repository ownership held by an execution host', (t) => {
  const f = new CleanupFixture(t),
    workspace = f.prepare();
  const common = f.git('rev-parse', '--path-format=absolute', '--git-common-dir');
  const lease = new ExecutionLease(join(common, 'arcnexus/host.lease.sqlite'));
  try {
    const result = f.command(f.root, 'workspace', 'cleanup', 'package');
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /owns project execution/);
    assert.equal(existsSync(workspace.location), true);
  } finally {
    lease.close();
  }
});

test('package cleanup rejects missing targets and unrelated flags before creating state', (t) => {
  const f = new CleanupFixture(t);
  for (const args of [[], ['package', 'extra'], ['package', '--model', 'override']])
    assert.equal(f.command(f.root, 'workspace', 'cleanup', ...args).status, 2);
  assert.equal(existsSync(join(f.root, 'state')), false);
});

test('shared cleanup checks revisions, cancellation and releases ownership after refusal and success', (t) => {
  const f = new CleanupFixture(t),
    workspace = f.prepare();
  const service = new WorkspaceDisposal(join(f.root, 'state'));
  const target = { source: f.repo, packageId: 'package' };
  const input = { workspace: workspace.id, expectedRevision: workspace.revision };
  const controller = new AbortController();
  assert.throws(
    () => service.cleanup(target, { ...input, expectedRevision: 'stale' }, controller.signal),
    /revision changed/,
  );
  assert.equal(existsSync(workspace.location), true);
  assert.equal(service.cleanup(target, input, controller.signal).status, 'completed');
  const common = f.git('rev-parse', '--path-format=absolute', '--git-common-dir');
  new ExecutionLease(join(common, 'arcnexus/host.lease.sqlite')).close();
  controller.abort(new Error('Caller cancelled'));
  assert.throws(() => service.cleanup(target, {}, controller.signal), /Caller cancelled/);
});

test('cleanup reports uncertain disappearance without fabricating preserved or removed work', (t) => {
  const f = new CleanupFixture(t),
    workspace = f.prepare();
  f.git('worktree', 'remove', workspace.location);
  const result = f.command(f.root, 'workspace', 'cleanup', 'package');
  assert.equal(result.status, 1, result.stderr);
  assert.equal(JSON.parse(result.stdout).items[0].status, 'needs_attention');
  assert.equal(existsSync(f.report(workspace.id)), true);
});

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic'] });
