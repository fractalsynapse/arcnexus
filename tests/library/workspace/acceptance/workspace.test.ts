import {
  cleanupIntent,
  fixture,
  evidence,
  cli,
  managedScope,
} from '../support/workspace-fixture.js';
import { WorkspacePreparation } from '../../../../dist/library/workspace/workspace.js';
import { ExecutionLease } from '../../../../dist/library/coordination-store/execution-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';

import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { TestProcess, waitFor } from '../../testing/support/test-process.js';

/** Exercises workspace behavior through observable scenarios. */
class WorkspaceTests {
  /** Verifies that built prepare creates apinned workspace runs setup there and cleanup retains branch report. */
  builtPrepareCreatesAPinnedWorkspaceRunsSetupThereAndCleanupRetainsBranchReport(t: TestContext) {
    const f = fixture(t, [
      {
        command: 'node',
        args: [
          '-e',
          "require('fs').mkdirSync('generated',{recursive:true});require('fs').writeFileSync('generated/cwd',process.cwd())",
        ],
      },
    ]);
    const base = f.git('rev-parse', 'HEAD');
    const result = f.prepare();
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.base, base);
    assert.match(record.branch, /^codex\//);
    assert.equal(readFileSync(join(record.workspace, 'generated/cwd'), 'utf8'), record.workspace);
    assert.equal(f.git('status', '--porcelain'), '');
    assert.equal(f.git('branch', '--show-current'), 'staging');
    assert.equal(f.cleanup(record.id).status, 0);
    assert.equal(existsSync(record.workspace), false);
    assert.equal(f.git('rev-parse', record.branch), base);
    assert.equal(existsSync(join(f.state, 'runs', record.id, 'report.json')), true);
    assert.equal(f.cleanup(record.id).status, 0);
  }

  /** Verifies that dirty source is rejected without preparation. */
  dirtySourceIsRejectedWithoutPreparation(t: TestContext) {
    const f = fixture(t);
    writeFileSync(join(f.repo, 'source.txt'), 'dirty');
    const r = f.prepare();
    assert.equal(r.status, 2);
    assert.match(r.stderr, /clean/i);
  }

  /** Verifies that setup failure retains evidence and workspace. */
  setupFailureRetainsEvidenceAndWorkspace(t: TestContext) {
    const f = fixture(t, [
      { command: 'node', args: ['-e', 'console.error("setup broke");process.exit(4)'] },
    ]);
    const r = f.prepare();
    assert.equal(r.status, 1);
    const record = JSON.parse(r.stdout);
    assert.equal(record.status, 'failed');
    assert.ok(existsSync(record.workspace));
    assert.match(readFileSync(record.operationInvocations[0].result.log, 'utf8'), /setup broke/);
  }

  /** Verifies that setup source mutation is prevented before cleanup. */
  setupSourceMutationIsPreventedBeforeCleanup(t: TestContext) {
    const f = fixture(t, [
      { command: 'node', args: ['-e', "require('fs').writeFileSync('source.txt','changed')"] },
    ]);
    const r = f.prepare();
    assert.equal(r.status, 1);
    const record = JSON.parse(r.stdout);
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'original\n');
    assert.equal(f.cleanup(record.id).status, 0);
  }

  /** Verifies that cleanup refuses unknown ignored files and untracked files. */
  cleanupRefusesUnknownIgnoredFilesAndUntrackedFiles(t: TestContext) {
    const f = fixture(t);
    const r = f.prepare();
    assert.equal(r.status, 0, r.stderr);
    const record = JSON.parse(r.stdout);
    for (const name of ['.env', 'valuable.txt']) {
      writeFileSync(join(record.workspace, name), 'keep');
      assert.equal(f.cleanup(record.id).status, 1);
      assert.equal(readFileSync(join(record.workspace, name), 'utf8'), 'keep');
      rmSync(join(record.workspace, name));
    }
    assert.equal(f.cleanup(record.id).status, 0);
  }

  /** Rejects executable legacy preparation while retaining static configuration inspection. */
  rejectsLegacyPreparation(t: TestContext): void {
    const f = fixture(t);
    const path = join(f.repo, '.arc/architecture/environment.yaml');
    writeFileSync(
      path,
      JSON.stringify({
        ...JSON.parse(readFileSync(path, 'utf8')),
        schemaVersion: 3,
        prerequisites: [],
        generatedDirectories: ['generated'],
        setup: [
          { command: 'node', args: ['-e', "require('fs').writeFileSync('source.txt','bad')"] },
        ],
      }),
    );
    f.commit();
    const result = f.prepare();
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /environment.*schema.*4.*migrat/i);
    assert.equal(result.stdout, '');
    assert.equal(readFileSync(join(f.repo, 'source.txt'), 'utf8'), 'original\n');
    const inspected = f.run('validate', '--project', f.repo);
    assert.equal(inspected.status, 0, inspected.stderr);
  }

  /** Rejects retired execution deadlines before preparation begins. */
  rejectsRetiredPreparationDeadline(t: TestContext) {
    const f = fixture(t, [{ command: 'node', args: ['-e', 'setInterval(()=>{},1000)'] }]);
    const r = f.prepare('--timeout-seconds', '0.2');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Unsupported workspace query option/);
    assert.equal(r.stdout, '');
  }

  /** Verifies that sigintcancels command and releases lock. */
  async SIGINTCancelsCommandAndReleasesLock(t: TestContext) {
    const f = fixture(t, [
      { command: 'node', args: ['-e', 'console.log("READY");setInterval(()=>{},1000)'] },
    ]);
    const child = new TestProcess(t, [cli, ...f.prepareArgs], f.env);
    await child.waitForReady(
      () => this.setupIsReady(f),
      'Setup must be running before cancellation',
    );
    child.kill('SIGINT');
    assert.equal(await child.closed, 130);
    assert.equal(JSON.parse(child.stdout).workspace.status, 'cancelled');
    assert.equal(existsSync(join(f.state, 'active.lock')), false);
  }

  /** Observes actual command output rather than sleeping through a possibly failed launch. */
  private setupIsReady(f: any): boolean {
    for (const id of readdirSync(join(f.state, 'runs'))) {
      const run = join(f.state, 'runs', id);
      if (
        readdirSync(run).some(
          (name) =>
            name.startsWith('invocation-') &&
            name.endsWith('.log') &&
            readFileSync(join(run, name), 'utf8').includes('READY'),
        )
      )
        return true;
    }
    return false;
  }

  /** Verifies that invalid configuration and missing prerequisite fail at their respective stages. */
  invalidConfigurationAndMissingPrerequisiteFailAtTheirRespectiveStages(t: TestContext) {
    const f = fixture(t);
    const path = join(f.repo, '.arc/architecture/operations/verify.yaml');
    const operation = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify({ ...operation, generatedDirectories: ['../escape'] }));
    f.git('add', '.');
    f.git('commit', '-m', 'invalid');
    assert.equal(f.prepare().status, 2);
    writeFileSync(path, JSON.stringify({ ...operation, command: 'arcnexus-nonexistent-tool' }));
    const platformPath = join(f.repo, '.arc/architecture/components/platform.json');
    const platform = JSON.parse(readFileSync(platformPath, 'utf8'));
    platform.operations.verify = ['preflight'];
    writeFileSync(platformPath, JSON.stringify(platform));
    f.git('add', '.');
    f.git('commit', '-m', 'missing tool');
    const r = f.prepare();
    assert.equal(r.status, 1);
    assert.equal(JSON.parse(r.stdout).operationInvocations.length, 1);
  }

  /** Verifies that lock prevents overlapping operations and ownership tampering refuses cleanup. */
  lockPreventsOverlappingOperationsAndOwnershipTamperingRefusesCleanup(t: TestContext) {
    const f = fixture(t);
    const r = f.prepare();
    assert.equal(r.status, 0, r.stderr);
    const record = JSON.parse(r.stdout);
    const lease = new ExecutionLease(join(f.repo, '.git/arcnexus/host.lease.sqlite'));
    try {
      assert.equal(f.prepare().status, 1);
    } finally {
      lease.close();
    }
    const path = join(f.state, 'runs', record.id, 'report.json');
    writeFileSync(path, JSON.stringify({ ...record, workspace: f.repo }));
    const rejected = f.cleanup(record.id);
    assert.equal(rejected.status, 2);
    assert.match(rejected.stderr, /not a managed workspace/);
    assert.ok(existsSync(f.repo));
  }

  /** Verifies that explicit base remains pinned while source headadvances. */
  async explicitBaseRemainsPinnedWhileSourceHEADAdvances(t: TestContext) {
    const f = fixture(t),
      base = f.git('rev-parse', 'HEAD');
    writeFileSync(join(f.repo, 'source.txt'), 'new');
    f.git('add', '.');
    f.git('commit', '-m', 'advance');
    const r = await new WorkspacePreparation(f.state).prepare(
      { source: f.repo, base, packageId: 'package' },
      new AbortController().signal,
    );
    assert.equal(r.workspace.status, 'prepared');
    assert.equal(readFileSync(join(r.workspace.location, 'source.txt'), 'utf8'), 'original\n');
    assert.equal(readFileSync(join(f.repo, 'source.txt'), 'utf8'), 'new');
  }

  /** Verifies that worktree creation does not overwrite acolliding branch or directory. */
  async worktreeCreationDoesNotOverwriteACollidingBranchOrDirectory(t: TestContext) {
    const { createWorkspace, prepareWorkspace } =
      await import('../../../../dist/library/workspace/workspace.js');
    const { stateRoot } = await import('../../../../dist/library/workspace/state.js');
    const f = fixture(t);
    const previous = process.env.ARCNEXUS_STATE_DIR;
    process.env.ARCNEXUS_STATE_DIR = f.state;
    t.after(() => {
      if (previous === undefined) delete process.env.ARCNEXUS_STATE_DIR;
      else process.env.ARCNEXUS_STATE_DIR = previous;
    });
    const root = stateRoot(),
      record = createWorkspace(root, { project: f.repo });
    f.git('branch', record.branch);
    await assert.rejects(prepareWorkspace(root, record, new AbortController().signal));
    f.git('branch', '-D', record.branch);
    mkdirSync(record.workspace);
    writeFileSync(join(record.workspace, 'precious'), 'keep');
    await assert.rejects(prepareWorkspace(root, record, new AbortController().signal));
    assert.equal(readFileSync(join(record.workspace, 'precious'), 'utf8'), 'keep');
  }

  /** Verifies the scenario preserves cleanup evidence on retry. */
  preservesCleanupEvidenceOnRetry(t: TestContext, failed: any) {
    const f = fixture(t, failed ? [{ command: 'node', args: ['-e', 'process.exit(4)'] }] : []);
    const prepared = f.prepare();
    assert.equal(prepared.status, failed ? 1 : 0, prepared.stderr);
    const record = JSON.parse(prepared.stdout),
      original = evidence(f, record);
    const first = f.cleanup(record.id);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(JSON.parse(first.stdout).items[0].status, 'removed');
    original.assertReports();
    const receiptPath = join(original.dir, 'cleanup.json'),
      receipt = readFileSync(receiptPath);
    const metadata = JSON.parse(String(receipt));
    assert.equal(metadata.cleanupStatus, 'removed');
    assert.ok(Number.isFinite(Date.parse(metadata.removedAt)));
    assert.equal(existsSync(record.workspace), false);
    const second = f.cleanup(record.id);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(JSON.parse(second.stdout).items[0].status, 'removed');
    original.assertReports();
    assert.deepEqual(readFileSync(receiptPath), receipt);
  }

  /** Verifies the scenario rejects replacement during cleanup. */
  rejectsReplacementDuringCleanup(t: TestContext, legacy: any) {
    const f = fixture(t),
      prepared = f.prepare();
    assert.equal(prepared.status, 0, prepared.stderr);
    const record = JSON.parse(prepared.stdout);
    this.removeInitialCandidate(f, record, legacy);
    const original = evidence(f, record),
      receiptPath = join(original.dir, 'cleanup.json');
    const receipt = legacy ? undefined : readFileSync(receiptPath);
    const checkEvidence = () => {
      original.assertReports();
      if (legacy) assert.equal(existsSync(receiptPath), false);
      else assert.deepEqual(readFileSync(receiptPath), receipt);
    };
    for (const kind of ['file', 'directory', 'symlink', 'dangling symlink']) {
      this.assertReplacementPreserved(f, record, kind);
      checkEvidence();
      rmSync(record.workspace, { recursive: true });
    }
    for (let i = 0; i < 2; i++) {
      const result = f.cleanup(record.id);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).items[0].status, 'removed');
      checkEvidence();
    }
  }

  /** Removes the initial candidate through current cleanup or a historical receipt fixture. */
  private removeInitialCandidate(f: any, record: any, legacy: boolean): void {
    if (legacy) {
      f.git('worktree', 'remove', record.workspace);
      record.status = 'removed';
      writeFileSync(join(f.state, 'runs', record.id, 'report.json'), JSON.stringify(record));
    } else {
      const result = f.cleanup(record.id);
      assert.equal(result.status, 0, result.stderr);
    }
  }

  /** Verifies that assert replacement preserved. */
  private assertReplacementPreserved(f: any, record: any, kind: string): void {
    if (kind === 'file') writeFileSync(record.workspace, 'keep');
    else if (kind === 'directory') {
      mkdirSync(record.workspace);
      writeFileSync(join(record.workspace, 'keep'), 'keep');
    } else symlinkSync(kind === 'symlink' ? f.repo : join(f.root, 'missing'), record.workspace);
    const result = f.cleanup(record.id);
    assert.equal(result.status, 1, `${kind}: ${result.stderr}`);
    if (kind.includes('symlink')) {
      assert.ok(lstatSync(record.workspace).isSymbolicLink());
      assert.equal(
        readlinkSync(record.workspace),
        kind === 'symlink' ? f.repo : join(f.root, 'missing'),
      );
    } else
      assert.equal(
        readFileSync(kind === 'file' ? record.workspace : join(record.workspace, 'keep'), 'utf8'),
        'keep',
      );
  }

  /** Verifies that preserves evidence after parent loss. */
  async preservesEvidenceAfterParentLoss(t: TestContext) {
    const f = fixture(t, [
      {
        command: process.execPath,
        args: ['-e', "console.log('COMMAND_PID='+process.pid);setInterval(()=>{},1000)"],
      },
    ]);
    const child = new TestProcess(t, [cli, ...f.prepareArgs], f.env);
    let captured: { scope: string; record: string; log: string } | undefined;
    await child.waitForReady(() => {
      captured = this.runningSetup(f, child.child.pid!);
      return !!captured;
    }, 'Command must reach observable running state');
    assert.ok(captured);
    child.kill('SIGKILL');
    await child.closed;
    await waitFor(
      () => !existsSync(captured!.scope),
      'Parent-loss supervisor must stop command group',
      5000,
    );
    assert.equal(existsSync(captured.scope), false);
    assert.match(readFileSync(captured.log, 'utf8'), /COMMAND_PID=/);
    assert.equal(JSON.parse(readFileSync(captured.record, 'utf8')).finishedAt, undefined);
  }

  /** Correlates a running command log with the kernel scope owned by this test's CLI. */
  private runningSetup(
    f: any,
    pid: number,
  ): { scope: string; record: string; log: string } | undefined {
    const scope = managedScope(pid);
    if (!scope) return undefined;
    for (const id of readdirSync(join(f.state, 'runs'))) {
      const directory = join(f.state, 'runs', id);
      for (const name of readdirSync(directory)) {
        if (!name.startsWith('invocation-') || !name.endsWith('.log')) continue;
        const log = join(directory, name);
        if (readFileSync(log, 'utf8').includes('COMMAND_PID='))
          return { scope, log, record: join(directory, 'report.json') };
      }
    }
    return undefined;
  }

  /** Verifies that cleanup reconciles primary removal only with durable matching intent. */
  cleanupReconcilesPrimaryRemovalOnlyWithDurableMatchingIntent(t: TestContext) {
    const f = fixture(t),
      r = f.prepare();
    assert.equal(r.status, 0, r.stderr);
    const record = JSON.parse(r.stdout);
    const dir = join(f.state, 'runs', record.id);
    const intent = cleanupIntent(record);
    writeFileSync(join(dir, 'cleanup-intent.json'), JSON.stringify(intent));
    writeFileSync(join(dir, 'members-cleanup.json'), JSON.stringify({ removed: [] }));
    const before = readFileSync(join(dir, 'report.json'));
    f.git('worktree', 'remove', record.workspace);
    const result = f.cleanup(record.id);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readFileSync(join(dir, 'report.json')), before);
    assert.equal(
      JSON.parse(String(readFileSync(join(dir, 'cleanup-intent.json')))).status,
      'removed',
    );
    assert.equal(f.cleanup(record.id).status, 0);
  }

  /** Verifies that cleanup refuses unexplained disappearance and replacement after intent. */
  cleanupRefusesUnexplainedDisappearanceAndReplacementAfterIntent(t: TestContext) {
    const f = fixture(t),
      record = JSON.parse(f.prepare().stdout),
      dir = join(f.state, 'runs', record.id);
    const intent = cleanupIntent(record);
    f.git('worktree', 'remove', record.workspace);
    assert.equal(f.cleanup(record.id).status, 1);
    writeFileSync(join(dir, 'cleanup-intent.json'), JSON.stringify(intent));
    mkdirSync(record.workspace);
    writeFileSync(join(record.workspace, 'precious'), 'keep');
    assert.equal(f.cleanup(record.id).status, 1);
    assert.equal(readFileSync(join(record.workspace, 'precious'), 'utf8'), 'keep');
  }
}

const suite = new WorkspaceTests();

test('built prepare creates a pinned workspace, runs setup there and cleanup retains branch/report', (t: any) =>
  suite.builtPrepareCreatesAPinnedWorkspaceRunsSetupThereAndCleanupRetainsBranchReport(t));

test('dirty source is rejected without preparation', (t: any) =>
  suite.dirtySourceIsRejectedWithoutPreparation(t));

test('setup failure retains evidence and workspace', (t: any) =>
  suite.setupFailureRetainsEvidenceAndWorkspace(t));

test('setup source mutation is prevented before cleanup', (t: any) =>
  suite.setupSourceMutationIsPreventedBeforeCleanup(t));

test('cleanup refuses unknown ignored files and untracked files', (t: any) =>
  suite.cleanupRefusesUnknownIgnoredFilesAndUntrackedFiles(t));

test('preparation rejects retired execution deadlines', (t: any) =>
  suite.rejectsRetiredPreparationDeadline(t));

test('SIGINT cancels command and releases lock', (t: any) =>
  suite.SIGINTCancelsCommandAndReleasesLock(t));

test('invalid configuration and missing prerequisite fail at their respective stages', (t: any) =>
  suite.invalidConfigurationAndMissingPrerequisiteFailAtTheirRespectiveStages(t));

test('lock prevents overlapping operations and ownership tampering refuses cleanup', (t: any) =>
  suite.lockPreventsOverlappingOperationsAndOwnershipTamperingRefusesCleanup(t));

test('explicit base remains pinned while source HEAD advances', (t: any) =>
  suite.explicitBaseRemainsPinnedWhileSourceHEADAdvances(t));

test('worktree creation does not overwrite a colliding branch or directory', (t: any) =>
  suite.worktreeCreationDoesNotOverwriteACollidingBranchOrDirectory(t));

for (const failed of [false, true])
  test(`cleanup preserves ${failed ? 'failed' : 'successful'} run evidence and receipt on retry`, (t: any) =>
    suite.preservesCleanupEvidenceOnRetry(t, failed));

for (const legacy of [false, true])
  test(`cleanup refuses replacement paths and safely handles ${legacy ? 'legacy' : 'current'} removal`, (t: any) =>
    suite.rejectsReplacementDuringCleanup(t, legacy));

test('hard parent death stops a finite setup process group and preserves incomplete evidence', (t: any) =>
  suite.preservesEvidenceAfterParentLoss(t));

test('cleanup reconciles primary removal only with durable matching intent', (t: any) =>
  suite.cleanupReconcilesPrimaryRemovalOnlyWithDurableMatchingIntent(t));

test('cleanup refuses unexplained disappearance and replacement after intent', (t: any) =>
  suite.cleanupRefusesUnexplainedDisappearanceAndReplacementAfterIntent(t));

registerSuite({
  component: 'workspace',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});

test('preparation rejects legacy recipes before candidate creation', (t) =>
  suite.rejectsLegacyPreparation(t));
