import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import {
  ExecutionContext,
  executionIdentity,
} from '../../../../dist/library/architecture/execution-context.js';
import { digest } from '../../../../dist/library/architecture/assignment.js';
import type { ExecutionAssignment } from '../../../../dist/library/coordination-store/execution-types.js';
import { DeliveryStore } from '../../../../dist/library/coordination-store/delivery-store.js';
import { Publisher } from '../../../../dist/library/publisher/publisher.js';
import { AssembledDelivery } from '../../../../dist/library/execution-runtime/assembled-delivery.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { candidateDigest } from '../../../../dist/library/change-inspection/changes.js';
import { DeliveryEvidence } from '../../../../dist/library/report/report.js';
import { CandidateSnapshots } from '../../../../dist/library/workspace/candidates.js';
import { createWorkspace, prepareWorkspace } from '../../../../dist/library/workspace/workspace.js';
import { save, type RecordData } from '../../../../dist/library/workspace/state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Supplies controlled prepared contributions while exercising real confined checks and verifier transport. */
class AssemblyFixture {
  readonly fixture;

  readonly context;

  readonly host;

  readonly run;

  readonly implementation;

  readonly regression;

  /** Captures a verification operation whose regression needs another owner's implementation. */
  constructor(t: TestContext) {
    this.fixture = new GeneralFixture(t).fixture;
    writeFileSync(
      join(this.fixture.repo, 'verify.cjs'),
      "if(require('fs').existsSync('b/regression.cjs'))require('./b/regression.cjs');",
    );
    this.fixture.commit();
    this.context = new ExecutionContext().resolve(this.fixture.repo);
    this.host = new ProjectHost(this.fixture.state, this.context);
    t.after(() => this.host.close());
    this.run = this.runContext();
    this.implementation = this.host.store.enqueue(this.run.id, 'a', 'Implement shared behavior', [
      'Source implements behavior',
    ]);
    this.regression = this.host.store.request(this.implementation.id, {
      key: 'regression',
      owner: 'b',
      objective: 'Test shared behavior',
      acceptance: ['Regression passes with implementation'],
    });
  }

  /** Uses an explicit simulated workday identity without inventing any upstream success receipts. */
  private runContext() {
    const run = this.host.store.createRun(
      'workday',
      this.context.owners,
      'Verify the dependent implementation and regression together',
      { id: 'controlled-assembly-environment', mode: 'simulation' },
    );
    this.host.store.updateRun(run.id, 'running', {
      authorityBase: this.context.base,
      candidateRevision: this.context.base,
      packageId: this.context.packageId,
      executionIdentity: executionIdentity(this.context),
    });
    return this.host.store.run(run.id);
  }

  /** Creates an owner workspace and a real durable checkpoint without scripting a successful host check. */
  async prepare(item: ExecutionAssignment, path: string, content: string): Promise<RecordData> {
    const record = this.record(item);
    await prepareWorkspace(this.fixture.state, record, new AbortController().signal);
    mkdirSync(dirname(join(record.workspace, path)), { recursive: true });
    writeFileSync(join(record.workspace, path), content);
    this.checkpoint(record);
    const revision = new CandidateSnapshots(
      this.fixture.repo,
      join(this.fixture.state, 'snapshots'),
    ).capture(record.workspace, record.base);
    this.host.store.updateAssignment(item.id, 'running', { recordId: record.id });
    this.host.store.prepareContribution(item.id, {
      recordId: record.id,
      base: record.base,
      revision,
      checkpoint: (record.checkpoint as { sha256: string }).sha256,
    });
    return record;
  }

  /** Captures one accountable owner and its original acceptance before any candidate edits. */
  private record(item: ExecutionAssignment): RecordData {
    const record = createWorkspace(this.fixture.state, {
      project: this.fixture.repo,
      base: this.context.base,
      packageId: this.context.packageId,
      bindings: this.context.bindings,
    });
    record.executionRunId = this.run.id;
    record.executionEnvironment = this.run.environment;
    record.assignmentId = item.id;
    record.resolvedAssignment = new ExecutionContext().assignment(this.context, item.owner, {
      schemaVersion: 3,
      kind: 'change',
      changeType: 'behavior',
      objective: item.objective,
      expectedOutcome: item.objective,
      acceptanceCriteria: item.acceptance,
      hostChecks: [],
    });
    return record;
  }

  /** Pins actual candidate bytes and captured authority for the production checkpoint validator. */
  private checkpoint(record: RecordData): void {
    const authority = record.resolvedAssignment as { digest: string };
    const path = join(this.fixture.state, 'runs', record.id, 'controlled-checkpoint.json');
    const bytes = JSON.stringify({
      authorityHash: authority.digest,
      candidateDigest: candidateDigest(record),
    });
    writeFileSync(path, bytes);
    record.checkpoint = { path, sha256: digest(bytes) };
    record.continuationAuthority = authority.digest;
    record.safeCheckpoint = true;
    record.status = 'prepared';
    save(this.fixture.state, record);
  }
}

/** Qualifies the assembled boundary through built runtime, SQLite, native operations and independent review wiring. */
class AssemblyScenarios {
  /** Observed red assembly checks retain source and return work to normal correction without delivery. */
  async rejects(t: TestContext): Promise<void> {
    const f = new AssemblyFixture(t);
    await f.prepare(f.implementation, 'source.txt', 'wrong');
    await f.prepare(
      f.regression,
      'b/regression.cjs',
      "require('assert').equal(require('fs').readFileSync('source.txt','utf8'),'assembled');",
    );
    const assembly = new AssembledDelivery(f.fixture.state, f.context, f.host.store);
    await assembly.advance(f.host.store.run(f.run.id), new AbortController().signal);
    assert.ok(f.host.store.assignments(f.run.id).every((item) => item.status === 'failed'));
    const run = f.host.store.run(f.run.id);
    assert.equal(run.data.candidateRevision, f.context.base);
    assert.equal(run.data.pendingAssembly, null);
    assert.match(String((run.data.lastAssembly as any).reason), /Assembled checks failed/);
    assert.ok(f.host.store.assignments(f.run.id).every((item) => item.evidence.length === 0));
  }

  /** Reuses a completed assessment after interruption immediately before atomic promotion. */
  async recovers(t: TestContext): Promise<void> {
    const f = new AssemblyFixture(t);
    await f.prepare(f.implementation, 'source.txt', 'assembled');
    await f.prepare(
      f.regression,
      'b/regression.cjs',
      "require('assert').equal(require('fs').readFileSync('source.txt','utf8'),'assembled');",
    );
    const complete = f.host.store.completeAssembly.bind(f.host.store);
    f.host.store.completeAssembly = () => {
      throw new Error('Injected before promotion');
    };
    const assembly = new AssembledDelivery(f.fixture.state, f.context, f.host.store);
    await assert.rejects(
      assembly.advance(f.host.store.run(f.run.id), new AbortController().signal),
      /Injected before promotion/,
    );
    const calls = readFileSync(f.fixture.calls, 'utf8');
    f.host.store.completeAssembly = complete;
    await assembly.advance(f.host.store.run(f.run.id), new AbortController().signal);
    assert.equal(readFileSync(f.fixture.calls, 'utf8'), calls);
    assert.ok(f.host.store.assignments(f.run.id).every((item) => item.status === 'completed'));
    assert.equal(f.host.store.run(f.run.id).data.pendingAssembly, null);
  }

  /** A combined candidate passes while each original contribution remains on its own branch. */
  async accepts(t: TestContext): Promise<void> {
    const f = new AssemblyFixture(t);
    const implementation = await f.prepare(f.implementation, 'source.txt', 'assembled');
    const regression = await f.prepare(
      f.regression,
      'b/regression.cjs',
      "require('assert').equal(require('fs').readFileSync('source.txt','utf8'),'assembled');",
    );
    const assembly = new AssembledDelivery(f.fixture.state, f.context, f.host.store);
    assert.equal(
      await assembly.advance(f.host.store.run(f.run.id), new AbortController().signal),
      true,
    );
    const assignments = f.host.store.assignments(f.run.id);
    assert.ok(assignments.every((item) => item.status === 'completed'));
    assert.equal(new Set(assignments.map((item) => item.data.deliveryRecordId)).size, 1);
    for (const item of assignments) {
      const observations = new DeliveryEvidence(f.fixture.state).capture(item) as any[];
      assert.equal(observations.length, 1);
      assert.equal(observations[0].evidenceUnavailable, undefined);
    }
    assert.notEqual(implementation.branch, regression.branch);
    assert.equal(f.fixture.git('rev-parse', 'HEAD'), f.context.base);
    assert.equal(f.host.store.run(f.run.id).data.pendingAssembly, null);
    this.publication(f, t);
  }

  /** Retains one combined publication rather than individually publishing red constituent branches. */
  private publication(f: AssemblyFixture, t: TestContext): void {
    const store = new DeliveryStore(join(f.fixture.state, 'assembly-deliveries.sqlite'));
    t.after(() => store.close());
    const run = f.host.store.run(f.run.id);
    const assignments = f.host.store.assignments(run.id);
    const delivery = new Publisher(f.fixture.state, store).capture(
      f.context.key,
      run,
      assignments,
      { repository: 'sample', branch: 'staging' },
    );
    assert.equal(delivery.assignmentIds.length, 2);
    assert.equal(delivery.developments, undefined);
    assert.equal(delivery.engineering, 'verified');
    assert.equal(store.list().length, 1);
  }
}

const scenarios = new AssemblyScenarios();

test('completed assembly recovery never repeats its independent model assessment', (t) =>
  scenarios.recovers(t));

test('failed assembled checks retain contributions and never claim delivery', (t) =>
  scenarios.rejects(t));

test('dependent engineering contributions pass one assembled acceptance and independent review', (t) =>
  scenarios.accepts(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
