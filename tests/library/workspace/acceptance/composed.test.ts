import { TestProcess } from '../../testing/support/test-process.js';
import { composed } from '../support/composed-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { cli, stewardEntry } from '../../testing/support/workflow-fixture.js';

/** Exercises composed behavior through observable scenarios. */
class ComposedTests {
  /** Verifies that built prepare creates pinned dependency worktrees and guarded cleanup preserves originals. */
  builtPrepareCreatesPinnedDependencyWorktreesAndGuardedCleanupPreservesOriginals(t: TestContext) {
    const f = composed(t),
      r = f.prepare();
    assert.equal(r.status, 0, r.stderr);
    const v = JSON.parse(r.stdout),
      member = v.members[0];
    assert.equal(member.base, f.environment.workspace.dependencies[0].commit);
    assert.equal(readFileSync(join(member.workspace, 'generated/cwd'), 'utf8'), member.workspace);
    assert.equal(f.dg('status', '--porcelain'), '');
    assert.equal(f.git('status', '--porcelain'), '');
    const report = readFileSync(join(f.state, 'runs', v.id, 'report.json'));
    assert.equal(f.cleanup(v.id).status, 0);
    assert.equal(existsSync(member.workspace), false);
    assert.equal(existsSync(v.workspace), false);
    assert.equal(f.cleanup(v.id).status, 0);
    assert.deepEqual(readFileSync(join(f.state, 'runs', v.id, 'report.json')), report);
    assert.equal(f.git('rev-parse', v.branch), v.base);
  }

  /** Verifies the scenario refuses dirty dependency cleanup. */
  refusesDirtyDependencyCleanup(t: TestContext, kind: any) {
    const f = composed(t),
      r = f.prepare();
    assert.equal(r.status, 0, r.stderr);
    const v = JSON.parse(r.stdout),
      member = v.members[0];
    const p = join(
      member.workspace,
      kind === 'tracked' ? 'source.txt' : kind === 'untracked' ? 'precious' : 'unknown/precious',
    );
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, 'keep');
    assert.equal(f.cleanup(v.id).status, 1);
    assert.ok(existsSync(v.workspace));
    assert.equal(readFileSync(p, 'utf8'), 'keep');
  }

  /** Verifies the scenario rejects invalid member preparation. */
  rejectsInvalidMemberPreparation(t: TestContext, kind: any) {
    const f = composed(t),
      dep = f.environment.workspace.dependencies[0];
    if (kind === 'identity') dep.repository = 'https://example.invalid/wrong.git';
    if (kind === 'dirty') writeFileSync(join(f.dependency, 'source.txt'), 'dirty');
    if (kind === 'overlap')
      f.environment.workspace.dependencies.push({
        ...dep,
        id: 'other',
        path: 'packages/dependency/nested',
      });
    if (kind === 'tracked-mount') {
      mkdirSync(join(f.repo, 'packages/dependency'), { recursive: true });
      writeFileSync(join(f.repo, 'packages/dependency/owned'), 'source');
      f.git('add', '-f', 'packages');
    }
    if (kind === 'generated-overlap') {
      const path = join(f.repo, 'architecture/operations/verify.yaml');
      const operation = JSON.parse(readFileSync(path, 'utf8'));
      writeFileSync(path, JSON.stringify({ ...operation, generatedDirectories: ['packages'] }));
    }
    if (kind === 'missing-binding')
      writeFileSync(f.bindings, JSON.stringify({ schemaVersion: 1, repositories: {}, tools: {} }));
    f.commit();
    const r = f.prepare();
    assert.equal(r.status, 2, r.stderr);
  }

  /** Verifies that run grants dependency read access and retains unchanged inventory. */
  runGrantsDependencyReadAccessAndRetainsUnchangedInventory(t: TestContext) {
    const f = composed(t),
      r = f.run('--bindings', f.bindings);
    assert.equal(r.status, 0, r.stderr);
    const v = JSON.parse(r.stdout);
    assert.equal(v.settings.filesystem[v.workspace], 'read');
    assert.equal(v.members[0].workspace, join(v.workspace, 'packages/dependency'));
    assert.ok(
      Object.entries(v.settings.filesystem).every(
        ([path, grant]) => grant !== 'write' || !path.startsWith(v.workspace + '/'),
      ),
    );
    assert.ok(v.members[0].inventoryDigest);
  }

  /** Verifies that failed dependency preparation retains ownership and supports safe cleanup. */
  failedDependencyPreparationRetainsOwnershipAndSupportsSafeCleanup(t: TestContext) {
    const f = composed(t);
    f.setup({ command: 'node', args: ['-e', 'process.exit(6)'] });
    f.commit();
    const r = f.prepare();
    assert.equal(r.status, 1);
    const v = JSON.parse(r.stdout);
    assert.equal(v.members[0].status, 'created');
    const child = JSON.parse(
      readFileSync(join(f.state, 'runs', v.id + '-dependency', 'report.json'), 'utf8'),
    );
    assert.equal(child.operationInvocations.at(-1).result.exitCode, 6);
    assert.ok(existsSync(v.members[0].workspace));
    assert.equal(f.cleanup(v.id).status, 0);
  }

  /** Verifies that cleanup rejects amember path substituted outside the owned workspace. */
  cleanupRejectsAMemberPathSubstitutedOutsideTheOwnedWorkspace(t: TestContext) {
    const f = composed(t),
      r = f.prepare();
    assert.equal(r.status, 0, r.stderr);
    const v = JSON.parse(r.stdout);
    v.members[0].workspace = f.dependency;
    writeFileSync(join(f.state, 'runs', v.id, 'report.json'), JSON.stringify(v));
    const cleanup = f.cleanup(v.id);
    assert.equal(cleanup.status, 1);
    assert.match(JSON.parse(cleanup.stdout).items[0].error, /ownership/);
    assert.equal(readFileSync(join(f.dependency, 'source.txt'), 'utf8'), 'dependency');
  }

  /** Verifies that declared disposable dependency outputs can be cleaned after caller use. */
  declaredDisposableDependencyOutputsCanBeCleanedAfterCallerUse(t: TestContext) {
    const f = composed(t),
      r = f.prepare();
    assert.equal(r.status, 0, r.stderr);
    const v = JSON.parse(r.stdout);
    writeFileSync(join(v.members[0].workspace, 'generated/cwd'), 'caller rebuild');
    assert.equal(f.cleanup(v.id).status, 0);
  }

  /** Verifies that inspect captures resolved dependency revisions without creating worktrees. */
  inspectCapturesResolvedDependencyRevisionsWithoutCreatingWorktrees(t: TestContext) {
    const f = composed(t),
      r = spawnSync(
        process.execPath,
        [
          cli,
          'inspect',
          'sample',
          'Improve behavior',
          '--project',
          f.repo,
          '--bindings',
          f.bindings,
          '--json',
        ],
        { env: f.env, encoding: 'utf8' },
      );
    assert.equal(r.status, 0, r.stderr);
    const v = JSON.parse(r.stdout);
    assert.equal(v.workspaceMembers[0].base, f.environment.workspace.dependencies[0].commit);
    assert.equal(existsSync(f.state), false);
  }

  /** Verifies that assignment cannot activate acomponent owned by adependency repository. */
  assignmentCannotActivateAComponentOwnedByADependencyRepository(t: TestContext) {
    const f = composed(t);
    const r = spawnSync(
      process.execPath,
      [
        stewardEntry,
        'run',
        'dependency',
        'Inspect dependency',
        '--project',
        f.repo,
        '--bindings',
        f.bindings,
      ],
      { env: f.env, encoding: 'utf8', timeout: 15_000 },
    );
    assert.equal(r.status, 2);
    assert.match(r.stderr, /primary repository/);
  }

  /** Verifies that dependency changes by acontrolled executable fail the host boundary check. */
  dependencyChangesByAControlledExecutableFailTheHostBoundaryCheck(t: TestContext) {
    const f = composed(t);
    f.configure({ dependencyMutation: true });
    const r = f.run('--bindings', f.bindings);
    assert.equal(r.status, 1, r.stderr);
    assert.match(r.stderr, /changed source|dependency/i);
    assert.equal(f.dg('status', '--porcelain'), '');
  }

  /** Cancels only after the confined dependency command is running and retains its invocation evidence. */
  async dependencySetupCancellationRetainsPartialRecords(t: TestContext) {
    const f = composed(t);
    f.setup({ command: 'node', args: ['-e', 'console.log("READY");setInterval(()=>{},1000)'] });
    f.commit();
    const child = new TestProcess(t, [cli, ...f.prepareArgs], f.env);
    await child.waitForReady(() => this.dependencyReady(f), 'Dependency setup must be running');
    child.kill('SIGINT');
    assert.equal(await child.closed, 130, child.stderr);
    const id = JSON.parse(child.stdout).workspace.id;
    const record = JSON.parse(readFileSync(join(f.state, 'runs', id, 'report.json'), 'utf8'));
    assert.equal(record.members[0].status, 'created');
    const retained = JSON.parse(
      readFileSync(join(f.state, 'runs', record.id + '-dependency', 'report.json'), 'utf8'),
    );
    assert.equal(retained.operationInvocations.at(-1).status, 'cancelled');
    assert.ok(retained.operationInvocations.at(-1).result.durationMs > 0);
    assert.equal(f.cleanup(record.id).status, 0);
  }

  /** Observes a captured child invocation's actual output before the cancellation checkpoint. */
  private dependencyReady(f: any): boolean {
    for (const id of readdirSync(join(f.state, 'runs'))) {
      if (!id.endsWith('-dependency')) continue;
      const directory = join(f.state, 'runs', id);
      for (const name of readdirSync(directory))
        if (
          name.startsWith('invocation-') &&
          name.endsWith('.log') &&
          readFileSync(join(directory, name), 'utf8').includes('READY')
        )
          return true;
    }
    return false;
  }
}

const suite = new ComposedTests();

test('built prepare creates pinned dependency worktrees and guarded cleanup preserves originals', (t: any) =>
  suite.builtPrepareCreatesPinnedDependencyWorktreesAndGuardedCleanupPreservesOriginals(t));

for (const kind of ['tracked', 'untracked', 'ignored'])
  test(`cleanup refuses dependency ${kind} changes before removing any member`, (t: any) =>
    suite.refusesDirtyDependencyCleanup(t, kind));

for (const kind of [
  'identity',
  'dirty',
  'overlap',
  'tracked-mount',
  'generated-overlap',
  'missing-binding',
])
  test(`preflight rejects ${kind}`, (t: any) => suite.rejectsInvalidMemberPreparation(t, kind));

test('run grants dependency read access and retains unchanged inventory', (t: any) =>
  suite.runGrantsDependencyReadAccessAndRetainsUnchangedInventory(t));

test('failed dependency preparation retains ownership and supports safe cleanup', (t: any) =>
  suite.failedDependencyPreparationRetainsOwnershipAndSupportsSafeCleanup(t));

test('cleanup rejects a member path substituted outside the owned workspace', (t: any) =>
  suite.cleanupRejectsAMemberPathSubstitutedOutsideTheOwnedWorkspace(t));

test('declared disposable dependency outputs can be cleaned after caller use', (t: any) =>
  suite.declaredDisposableDependencyOutputsCanBeCleanedAfterCallerUse(t));

test('inspect captures resolved dependency revisions without creating worktrees', (t: any) =>
  suite.inspectCapturesResolvedDependencyRevisionsWithoutCreatingWorktrees(t));

test('assignment cannot activate a component owned by a dependency repository', (t: any) =>
  suite.assignmentCannotActivateAComponentOwnedByADependencyRepository(t));

test('dependency changes by a controlled executable fail the host boundary check', (t: any) =>
  suite.dependencyChangesByAControlledExecutableFailTheHostBoundaryCheck(t));

test('dependency setup cancellation retains partial records and can be cleaned', (t: any) =>
  suite.dependencySetupCancellationRetainsPartialRecords(t));

registerSuite({
  component: 'workspace',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
