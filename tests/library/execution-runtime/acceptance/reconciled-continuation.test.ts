import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { ReconciledContinuation } from '../../../../dist/library/execution-runtime/reconciled-continuation.js';
import { CandidateSnapshots } from '../../../../dist/library/workspace/candidates.js';
import { createWorkspace, prepareWorkspace } from '../../../../dist/library/workspace/workspace.js';
import { save, type RecordData } from '../../../../dist/library/workspace/state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Exercises retained preparation against real Git worktrees and host checkpoints. */
class ReconciledContinuationScenarios {
  /** Creates a settled engineering checkpoint through the production host. */
  private async fixture(t: TestContext) {
    const f = new GeneralFixture(t).fixture;
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.store.close());
    const run = host.submit('Research supplier evidence');
    await host.tick();
    await host.tick();
    const assignment = host.store.assignments(run.id)[0]!;
    const record = JSON.parse(
      readFileSync(join(f.state, 'runs', String(assignment.data.recordId), 'report.json'), 'utf8'),
    ) as RecordData;
    const base = f.git(
      'commit-tree',
      f.git('rev-parse', 'HEAD^{tree}'),
      '-p',
      f.git('rev-parse', 'HEAD^'),
      '-m',
      'Assembled equivalent staging',
    );
    assert.notEqual(f.git('rev-list', '--max-count=1', record.base, '--not', base), '');
    return this.prepare(f, host, record, assignment, base);
  }

  /** Prepares equivalent published content with distinct ancestry, matching assembled staging. */
  private async prepare(
    f: GeneralFixture['fixture'],
    host: ProjectHost,
    record: RecordData,
    assignment: ReturnType<ProjectHost['store']['assignment']>,
    base: string,
  ) {
    const next = createWorkspace(f.state, { project: f.repo, base, branchBase: base });
    Object.assign(next, { assignmentId: assignment.id, executionRunId: assignment.runId });
    await prepareWorkspace(f.state, next, new AbortController().signal);
    writeFileSync(join(next.workspace, 'source.txt'), 'retained reconciled source');
    const revision = new CandidateSnapshots(f.repo, join(f.state, 'snapshots')).capture(
      next.workspace,
      next.base,
    );
    host.store.updateAssignment(assignment.id, 'failed', {
      reconciliation: {
        recordId: next.id,
        workspace: next.workspace,
        current: next.base,
        revision,
      },
    });
    return { f, host, record, next, assignment: host.store.assignment(assignment.id) };
  }

  /** Completed source application survives retry without moving the old branch or rerunning setup. */
  async completed(t: TestContext): Promise<void> {
    const { f, host, record, next, assignment } = await this.fixture(t);
    const original = { branch: record.branch, workspace: record.workspace, base: record.base };
    const originalBytes = readFileSync(join(record.workspace, 'source.txt'));
    const preparedReport = readFileSync(join(f.state, 'runs', next.id, 'report.json'));
    const recovery = new ReconciledContinuation(f.state, host.store);
    host.store.updateAssignment(assignment.id, 'running');
    recovery.recover(assignment, record);
    assert.equal(host.store.assignment(assignment.id).status, 'running');
    assert.equal(record.workspace, next.workspace);
    assert.equal(record.branch, next.branch);
    assert.notEqual(record.branch, original.branch);
    assert.equal(f.git('rev-parse', original.branch), original.base);
    assert.deepEqual(readFileSync(join(original.workspace, 'source.txt')), originalBytes);
    assert.equal(
      readFileSync(join(record.workspace, 'source.txt'), 'utf8'),
      'retained reconciled source',
    );
    assert.equal(host.store.assignment(assignment.id).data.reconciliation, null);
    recovery.recover(assignment, record);
    assert.deepEqual(record.previousWorkspaces, [original.workspace]);
    assert.deepEqual(readFileSync(join(f.state, 'runs', next.id, 'report.json')), preparedReport);
  }

  /** A crash after the filesystem checkpoint only needs the outstanding store acknowledgement. */
  async acknowledgement(t: TestContext): Promise<void> {
    const { f, host, record, assignment } = await this.fixture(t);
    const recovery = new ReconciledContinuation(f.state, host.store);
    recovery.recover(assignment, record);
    const retained = JSON.stringify(record);
    host.store.updateAssignment(assignment.id, 'failed', {
      reconciliation: assignment.data.reconciliation,
    });
    recovery.recover(host.store.assignment(assignment.id), record);
    assert.equal(host.store.assignment(assignment.id).data.reconciliation, null);
    assert.equal(JSON.stringify(record), retained);
  }

  /** A preparation interruption stays uncertain and cannot dispatch or replay setup. */
  async interrupted(t: TestContext): Promise<void> {
    const { f, host, record, next, assignment } = await this.fixture(t);
    next.status = 'preparing';
    save(f.state, next);
    const originalWorkspace = record.workspace;
    assert.throws(
      () => new ReconciledContinuation(f.state, host.store).recover(assignment, record),
      /uncertain workspace preparation/,
    );
    assert.equal(record.workspace, originalWorkspace);
    assert.ok(host.store.assignment(assignment.id).data.reconciliation);
  }

  /** Changed successor source cannot be accepted merely because preparation finished. */
  async changed(t: TestContext): Promise<void> {
    const { f, host, record, next, assignment } = await this.fixture(t);
    writeFileSync(join(next.workspace, 'source.txt'), 'unobserved change');
    assert.throws(
      () => new ReconciledContinuation(f.state, host.store).recover(assignment, record),
      /differs from its retained transition/,
    );
    assert.notEqual(record.workspace, next.workspace);
    assert.ok(host.store.assignment(assignment.id).data.reconciliation);
  }
}

const scenarios = new ReconciledContinuationScenarios();

test('completed reconciliation retains both branches and recovers without repeating preparation', (t) =>
  scenarios.completed(t));

test('interrupted reconciliation cannot replay preparation', (t) => scenarios.interrupted(t));

test('changed reconciliation source cannot replace its checkpoint', (t) => scenarios.changed(t));

test('durably adopted reconciliation only acknowledges its pending store transition', (t) =>
  scenarios.acknowledgement(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
