import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import {
  ExecutionLease,
  ExecutionStore,
} from '../../../../dist/library/coordination-store/execution-store.js';
import { createWorkspace } from '../../../../dist/library/workspace/workspace.js';
import { save } from '../../../../dist/library/workspace/state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { generalCatalogFixture } from '../../testing/support/general-fixture.js';
import { WorkspaceCliFixture } from '../../testing/support/workspace-cli-fixture.js';

/** Runs the shipped cleanup command against real Git worktrees and controlled retained execution records. */
class DependencyCleanupScenarios {
  /** Registers portable architectural fixtures without requiring or executing a native model harness. */
  private fixture(t: TestContext) {
    const f = generalCatalogFixture(t);
    for (const directory of ['runs', 'workspaces'])
      mkdirSync(join(f.state, directory), { recursive: true });
    const bindings = join(f.root, 'bindings.json');
    writeFileSync(bindings, JSON.stringify({ schemaVersion: 1, tools: {}, repositories: {} }));
    const cli = new WorkspaceCliFixture(f, bindings);
    return Object.assign(f, { cleanup: (id: string) => cli.cleanup(id) });
  }

  /** Captures architecture normally; seeds completed preparation evidence without invoking a model or installer. */
  private setup(t: TestContext) {
    const f = this.fixture(t);
    const record = createWorkspace(f.state, { project: f.repo });
    f.git('worktree', 'add', '-b', record.branch, record.workspace, record.base);
    mkdirSync(join(record.workspace, 'generated'));
    writeFileSync(join(record.workspace, 'generated', 'dependency'), 'rebuildable');
    const store = new ExecutionStore(join(f.state, 'projects', 'fixture', 'execution.sqlite'));
    const run = store.createRun('task', ['sample'], 'Exercise dependency reclamation');
    store.updateRun(run.id, 'completed');
    store.close();
    record.executionRunId = run.id;
    record.status = 'completed';
    record.environment.generatedDirectories = ['generated'];
    record.operationInvocations = [{ status: 'completed' }];
    record.preparedDependencies = [
      { key: 'fixture', outputs: ['generated'], result: { exitCode: 0 } },
    ];
    save(f.state, record);
    return { f, record, directory: join(f.state, 'runs', record.id) };
  }

  /** Frees dependencies twice while preserving dirty source, original reports, worktree and branch. */
  reclaim(t: TestContext): void {
    const { f, record, directory } = this.setup(t);
    writeFileSync(join(record.workspace, 'source.txt'), 'retained engineering change\n');
    const before = readFileSync(join(directory, 'report.json'));
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = f.cleanup(record.id);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.equal(JSON.parse(result.stdout).items[0].status, 'dependencies_reclaimed');
    }
    assert.equal(existsSync(join(record.workspace, 'generated')), false);
    assert.equal(
      readFileSync(join(record.workspace, 'source.txt'), 'utf8'),
      'retained engineering change\n',
    );
    assert.deepEqual(readFileSync(join(directory, 'report.json')), before);
    assert.equal(f.git('rev-parse', record.branch), record.base);
  }

  /** Refuses paused runs, unsettled operations and missing historical preparation provenance. */
  refuse(t: TestContext, reason: 'paused' | 'operation' | 'historical'): void {
    const { f, record } = this.setup(t);
    if (reason === 'paused') {
      const store = new ExecutionStore(join(f.state, 'projects', 'fixture', 'execution.sqlite'));
      store.updateRun(String(record.executionRunId), 'paused');
      store.close();
    } else if (reason === 'operation') record.operationInvocations = [{ status: 'running' }];
    else delete record.preparedDependencies;
    save(f.state, record);
    const result = f.cleanup(record.id);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(existsSync(join(record.workspace, 'generated', 'dependency')));
  }

  /** Checks every target before deleting the first one, including aliases and maintained source. */
  unsafe(t: TestContext, symlink: boolean): void {
    const { f, record } = this.setup(t);
    const before = readFileSync(join(f.repo, 'source.txt'));
    const other = symlink ? 'aliased' : 'source.txt';
    if (symlink) symlinkSync(f.repo, join(record.workspace, other));
    record.environment.generatedDirectories.push(other);
    (record.preparedDependencies as any[])[0].outputs.push(other);
    save(f.state, record);
    assert.equal(f.cleanup(record.id).status, 1);
    assert.ok(existsSync(join(record.workspace, 'generated', 'dependency')));
    assert.deepEqual(readFileSync(join(f.repo, 'source.txt')), before);
  }

  /** Existing repository ownership prevents cleanup from racing a live host. */
  leased(t: TestContext): void {
    const { f, record } = this.setup(t);
    const lease = new ExecutionLease(join(record.commonDir, 'arcnexus', 'host.lease.sqlite'));
    try {
      assert.notEqual(f.cleanup(record.id).status, 0);
      assert.ok(existsSync(join(record.workspace, 'generated', 'dependency')));
    } finally {
      lease.close();
    }
  }

  /** Reports partial deletion honestly and retries through the same command after repair. */
  partial(t: TestContext): void {
    const { f, record } = this.setup(t);
    const blocked = join(record.workspace, 'blocked-output');
    mkdirSync(blocked);
    writeFileSync(join(blocked, 'dependency'), 'keep until writable');
    record.environment.generatedDirectories.push('blocked-output');
    (record.preparedDependencies as any[])[0].outputs.push('blocked-output');
    save(f.state, record);
    chmodSync(blocked, 0o555);
    try {
      const result = f.cleanup(record.id);
      assert.equal(result.status, 1);
      assert.equal(JSON.parse(result.stdout).items[0].status, 'needs_attention');
      assert.equal(existsSync(join(record.workspace, 'generated')), false);
    } finally {
      chmodSync(blocked, 0o755);
    }
    assert.equal(f.cleanup(record.id).status, 0);
  }

  /** Reconciles an interrupted removal whose dependency directory is already absent. */
  interrupted(t: TestContext): void {
    const { f, record, directory } = this.setup(t);
    writeFileSync(
      join(directory, 'dependency-cleanup.json'),
      JSON.stringify({
        id: record.id,
        outputs: ['generated'],
        workspace: record.workspace,
        status: 'removing',
      }),
    );
    rmSync(join(record.workspace, 'generated'), { recursive: true });
    const result = f.cleanup(record.id);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(
      JSON.parse(readFileSync(join(directory, 'dependency-cleanup.json'), 'utf8')).status,
      'reclaimed',
    );
    assert.ok(existsSync(join(record.workspace, 'source.txt')));
  }
}

const scenarios = new DependencyCleanupScenarios();

test('cleanup reclaims dependencies and preserves completed engineering evidence', (t) =>
  scenarios.reclaim(t));

for (const reason of ['paused', 'operation', 'historical'] as const)
  test('cleanup preserves dependencies for ' + reason, (t) => scenarios.refuse(t, reason));

test('cleanup validates later symlink targets before deleting earlier outputs', (t) =>
  scenarios.unsafe(t, true));

test('cleanup refuses tracked dependency output before any removal', (t) =>
  scenarios.unsafe(t, false));

test('cleanup respects a live repository execution lease', (t) => scenarios.leased(t));

test('cleanup reports and recovers partial dependency removal', (t) => scenarios.partial(t));

test('cleanup reconciles interrupted dependency removal without deleting source', (t) =>
  scenarios.interrupted(t));

registerSuite({
  component: 'workspace',
  level: 'acceptance',
  tags: ['deterministic', 'retention'],
});
