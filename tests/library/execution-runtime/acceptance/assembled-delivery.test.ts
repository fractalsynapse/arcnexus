import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type {
  ExecutionAssignment,
  PreparedContribution,
} from '../../../../dist/library/coordination-store/execution-types.js';
import { DeliveryStore } from '../../../../dist/library/coordination-store/delivery-store.js';
import { DeliveryChecks, Publisher } from '../../../../dist/library/publisher/publisher.js';
import { AssembledDelivery } from '../../../../dist/library/execution-runtime/assembled-delivery.js';
import { AssignmentDispatch } from '../../../../dist/library/execution-runtime/assignment-dispatch.js';
import type { DirectorResult } from '../../../../dist/library/task-intake/direction.js';
import { DeliveryEvidence } from '../../../../dist/library/report/report.js';
import type { RecordData } from '../../../../dist/library/workspace/state.js';
import { waitFor } from '../../testing/support/test-process.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';

import { AssemblyFixture } from '../support/assembly-fixture.js';

/** Qualifies the assembled boundary through built runtime, SQLite, native operations and independent review wiring. */
class AssemblyScenarios {
  /** Director findings resume validated preparation without rewriting peers or permitting stale checkpoints. */
  async correctsPrepared(t: TestContext): Promise<void> {
    const f = new AssemblyFixture(t, 'task');
    const record = await f.prepare(f.implementation, 'source.txt', 'unfinished');
    await f.prepare(f.regression, 'b/regression.cjs', '// retained peer');
    const peer = f.host.store.assignment(f.regression.id);
    const dispatch = new AssignmentDispatch(f.fixture.state, f.context, f.host.store);
    const result = this.correction(f.implementation, 'Caller observed a missing behavior');
    dispatch.apply(f.host.store.run(f.run.id), result);
    assert.equal(f.host.store.assignment(f.implementation.id).status, 'ready');
    assert.deepEqual(f.host.store.assignment(f.regression.id), peer);
    assert.equal(f.host.store.run(f.run.id).data.candidateRevision, f.context.base);
    assert.equal(
      new AssembledDelivery(f.fixture.state, f.context, f.host.store).ready(f.run),
      false,
    );
    const retained = JSON.parse(
      readFileSync(join(f.fixture.state, 'runs', record.id, 'report.json'), 'utf8'),
    );
    assert.equal(retained.continuationLoopWarning, undefined);
    this.rejectsChangedCheckpoint(f, record, dispatch);
  }

  /** A fresh finding cannot override changed checkpoint evidence or mutate scheduling on rejection. */
  private rejectsChangedCheckpoint(
    f: AssemblyFixture,
    record: RecordData,
    dispatch: AssignmentDispatch,
  ): void {
    const contribution = f.host.store.assignment(f.implementation.id).data.contribution;
    f.host.store.prepareContribution(f.implementation.id, contribution as PreparedContribution);
    writeFileSync((record.checkpoint as { path: string }).path, 'corrupt evidence');
    assert.throws(
      () =>
        dispatch.apply(
          f.host.store.run(f.run.id),
          this.correction(f.implementation, 'Another finding'),
        ),
      /Checkpoint evidence changed/,
    );
    assert.equal(f.host.store.assignment(f.implementation.id).status, 'prepared');
  }

  /** Supplies a normal continuation proposal without changing the owner's accepted scope. */
  private correction(item: ExecutionAssignment, reason: string): DirectorResult {
    return {
      status: 'ready',
      summary: reason,
      selectedOwners: [],
      rejectedOwners: [],
      questions: [],
      assignments: [],
      dependency: null,
      architectureProposal: null,
      continuations: [{ assignmentId: item.id, ownerId: item.owner, reason }],
      dependencyRetirementProposal: null,
    };
  }

  /** One independent assessment accepts the assembled task goal and both contributions together. */
  async task(t: TestContext): Promise<void> {
    const f = new AssemblyFixture(t, 'task');
    await f.prepare(f.implementation, 'source.txt', 'assembled');
    await f.prepare(
      f.regression,
      'b/regression.cjs',
      "require('assert').equal(require('fs').readFileSync('source.txt','utf8'),'assembled');",
    );
    await new AssembledDelivery(f.fixture.state, f.context, f.host.store).advance(
      f.host.store.run(f.run.id),
      new AbortController().signal,
    );
    const run = f.host.store.run(f.run.id);
    await this.reuse(f);
    this.publication(f, t);
    assert.equal(run.data.goalCandidate, run.data.candidateRevision);
    const references = run.data.goalEvidence as string[];
    assert.equal(references.length, 1);
    const report = JSON.parse(readFileSync(references[0]!, 'utf8'));
    assert.equal(report.activationRole, 'verifier');
    assert.deepEqual(report.acceptanceCriteria, [
      f.run.objective,
      ...f.implementation.acceptance,
      ...f.regression.acceptance,
    ]);
    assert.ok(f.host.store.assignments(f.run.id).every((item) => item.status === 'completed'));
  }

  /** Publication consumes the same accepted source without another operation or model activation. */
  private async reuse(f: AssemblyFixture): Promise<void> {
    const run = f.host.store.run(f.run.id);
    const calls = readFileSync(f.fixture.calls, 'utf8');
    const checks = new DeliveryChecks(
      f.fixture.state,
      f.context,
      run,
      f.host.store.requiredAssignments(run.id),
    );
    const result = await checks.check(
      String(run.data.candidateRevision),
      new AbortController().signal,
      true,
    );
    assert.equal(result.status, 'passed');
    assert.deepEqual(result.evidence.slice(1), run.data.goalEvidence);
    assert.equal(readFileSync(f.fixture.calls, 'utf8'), calls);
  }

  /** Disconnected task obligations cannot be silently omitted from the accepted whole-goal candidate. */
  async waitsForAll(t: TestContext): Promise<void> {
    const f = new AssemblyFixture(t, 'task');
    const extra = f.host.store.enqueue(f.run.id, 'c', 'Complete independent work', [
      'Independent result',
    ]);
    await f.prepare(f.implementation, 'source.txt', 'assembled');
    await f.prepare(f.regression, 'b/regression.cjs', "require('assert').ok(true);");
    const assembly = new AssembledDelivery(f.fixture.state, f.context, f.host.store);
    const signal = new AbortController().signal;
    assert.equal(assembly.ready(f.host.store.run(f.run.id)), false);
    assert.equal(await assembly.advance(f.host.store.run(f.run.id), signal), false);
    assert.equal(f.host.store.run(f.run.id).data.candidateRevision, f.context.base);
    await f.prepare(extra, 'c/result.txt', 'independent result');
    assert.equal(await assembly.advance(f.host.store.run(f.run.id), signal), true);
    assert.ok(f.host.store.assignments(f.run.id).every((item) => item.status === 'completed'));
  }

  /** Observed red assembly checks retain source and return work to normal correction without delivery. */
  async rejects(t: TestContext): Promise<void> {
    const f = new AssemblyFixture(t, 'task', true);
    await f.prepare(f.implementation, 'source.txt', 'wrong');
    await f.prepare(
      f.regression,
      'b/regression.cjs',
      "require('assert').equal(require('fs').readFileSync('source.txt','utf8'),'assembled');",
    );
    const assembly = new AssembledDelivery(f.fixture.state, f.context, f.host.store);
    await assembly.advance(f.host.store.run(f.run.id), new AbortController().signal);
    assert.ok(f.host.store.assignments(f.run.id).every((item) => item.status === 'prepared'));
    const run = f.host.store.run(f.run.id);
    assert.equal(run.data.candidateRevision, f.context.base);
    assert.equal(run.data.pendingAssembly, null);
    assert.match(String((run.data.lastAssembly as any).reason), /Assembled checks failed/);
    assert.equal(new AssembledDelivery(f.fixture.state, f.context, f.host.store).ready(run), false);
    assert.ok(f.host.store.assignments(f.run.id).every((item) => item.evidence.length === 0));
    await this.reassesses(f, assembly);
    const peer = f.host.store.assignment(f.regression.id);
    await f.prepare(f.implementation, 'source.txt', 'assembled');
    assert.deepEqual(f.host.store.assignment(f.regression.id), peer);
    assert.equal(assembly.ready(f.host.store.run(f.run.id)), true);
  }

  /** Ready direction with no new engineering consumes one reassessment without changing owner checkpoints. */
  private async reassesses(f: AssemblyFixture, assembly: AssembledDelivery): Promise<void> {
    const assignments = f.host.store.assignments(f.run.id);
    const previous = f.host.store.run(f.run.id).data.lastAssembly;
    f.host.store.updateRun(f.run.id, 'running', {
      prompt: 'REASSESS_PREPARED',
      initialized: false,
    });
    await f.host.tick();
    const run = f.host.store.run(f.run.id);
    assert.equal(run.status, 'running', String(run.data.error));
    assert.equal(run.data.initialized, true);
    assert.deepEqual((run.data.direction as DirectorResult).selectedOwners, []);
    assert.deepEqual(f.host.store.assignments(f.run.id), assignments);
    assert.equal(assembly.ready(run), true);
    await assembly.advance(run, new AbortController().signal);
    const rejected = f.host.store.run(f.run.id);
    assert.equal(assembly.ready(rejected), false);
    assert.equal(rejected.data.candidateRevision, f.context.base);
    assert.notDeepEqual(rejected.data.lastAssembly, previous);
    assert.deepEqual(f.host.store.assignments(f.run.id), assignments);
  }

  /** Final assembled checks cannot write maintained source, even through captured verification commands. */
  async confined(t: TestContext): Promise<void> {
    const f = new AssemblyFixture(t);
    await f.prepare(f.implementation, 'source.txt', 'assembled');
    await f.prepare(
      f.regression,
      'b/regression.cjs',
      "require('fs').writeFileSync('source.txt','unauthorized');",
    );
    await new AssembledDelivery(f.fixture.state, f.context, f.host.store).advance(
      f.host.store.run(f.run.id),
      new AbortController().signal,
    );
    const run = f.host.store.run(f.run.id);
    const record = this.assemblyRecord(f, (run.data.lastAssembly as any).recordId);
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'assembled');
    assert.match(this.logs(f, record.id), /EROFS|EACCES|EPERM/);
    assert.equal(run.data.candidateRevision, f.context.base);
    assert.ok(f.host.store.assignments(f.run.id).every((item) => item.status === 'prepared'));
  }

  /** Cancellation retains prepared contributions and observed assembly command evidence without promotion. */
  async cancelled(t: TestContext): Promise<void> {
    const f = new AssemblyFixture(t);
    const prepared = await f.prepare(f.implementation, 'source.txt', 'assembled');
    await f.prepare(
      f.regression,
      'b/regression.cjs',
      "console.log('ASSEMBLY_READY');setInterval(()=>{},1000);",
    );
    const controller = new AbortController();
    t.after(() => controller.abort());
    const result = new AssembledDelivery(f.fixture.state, f.context, f.host.store)
      .advance(f.host.store.run(f.run.id), controller.signal)
      .catch((error: unknown) => error);
    await waitFor(() => {
      const pending = f.host.store.run(f.run.id).data.pendingAssembly as any;
      return Boolean(pending && this.logs(f, pending.recordId).includes('ASSEMBLY_READY'));
    }, 'Assembly check must reach its cancellation boundary');
    controller.abort();
    await result;
    const run = f.host.store.run(f.run.id);
    const record = this.assemblyRecord(f, (run.data.pendingAssembly as any).recordId);
    assert.equal(run.data.candidateRevision, f.context.base);
    assert.ok((record.operationInvocations as any[])?.some((op: any) => op.status === 'cancelled'));
    assert.deepEqual(this.assemblyRecord(f, prepared.id).checkpoint, prepared.checkpoint);
    assert.ok(f.host.store.assignments(f.run.id).every((item) => item.status === 'prepared'));
  }

  /** Reads retained evidence without modifying the production checkpoint or candidate. */
  private assemblyRecord(f: AssemblyFixture, id: string): RecordData {
    return JSON.parse(readFileSync(join(f.fixture.state, 'runs', id, 'report.json'), 'utf8'));
  }

  /** Observes actual invocation logs while a managed check is running or completed. */
  private logs(f: AssemblyFixture, id: string): string {
    const directory = join(f.fixture.state, 'runs', id);
    return readdirSync(directory)
      .filter((path) => path.endsWith('.log'))
      .map((path) => readFileSync(join(directory, path), 'utf8'))
      .join('\n');
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

test('director correction resumes prepared checkpoints without losing peers or weakening validation', (t) =>
  scenarios.correctsPrepared(t));

test('completed assembly recovery never repeats its independent model assessment', (t) =>
  scenarios.recovers(t));

test('failed assembled checks retain contributions and never claim delivery', (t) =>
  scenarios.rejects(t));

test('dependent engineering contributions pass one assembled acceptance and independent review', (t) =>
  scenarios.accepts(t));

test('one assembled independent review accepts task goal and owner criteria together', (t) =>
  new AssemblyScenarios().task(t));

test('task assembly waits for disconnected engineering obligations', (t) =>
  scenarios.waitsForAll(t));

test('assembled host verification prevents maintained-source mutation', (t) =>
  scenarios.confined(t));

test('assembled verification cancellation preserves prepared evidence', (t) =>
  scenarios.cancelled(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
