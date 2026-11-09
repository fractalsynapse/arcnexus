import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test as nodeTest, type TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { AssignmentExecution } from '../../../../dist/library/execution-runtime/assignment-execution.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import {
  GeneralFixture,
  generalCatalogFixture,
  nativeHostTest as test,
} from '../../testing/support/general-fixture.js';

/** Exercises engineering discovery and explicit supplier reuse through the real MCP and scheduler boundaries. */
class AssignmentRegistryScenario {
  /** Links caller-specific criteria through the native harness without changing accepted supplier work. */
  async callerPurpose(t: TestContext): Promise<void> {
    const f = new GeneralFixture(t).fixture;
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.close());
    const run = host.submit('LINK_EXISTING_WORK CALLER_PURPOSE_LINK: retain caller evidence');
    await host.tick();
    const [sender, supplier] = host.store.assignments(run.id);
    await host.tick();
    const path = join(
      f.state,
      'runs',
      String(host.store.assignment(sender!.id).data.recordId),
      'report.json',
    );
    const record = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(record.requestCorrection, undefined);
    assert.equal(host.store.assignments(run.id).length, 2);
    const [request] = host.store.inbox(sender!.id);
    assert.ok(request);
    assert.equal(request.assignmentId, supplier!.id);
    assert.equal(request.objective, 'Use supplier evidence for caller integration');
    assert.deepEqual(request.acceptance, ['Distinct delivery evidence']);
    assert.deepEqual(host.store.assignment(supplier!.id), supplier);
    assert.deepEqual(host.store.assignment(sender!.id).dependencies, [supplier!.id]);
  }

  /** Discovers a not-started supplier through validated current-run evidence without duplicating work. */
  async run(t: TestContext): Promise<void> {
    const f = new GeneralFixture(t).fixture;
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.close());
    const run = host.submit('LINK_EXISTING_WORK: share the starting supplier');
    await host.tick();
    const sender = host.store.assignments(run.id).find((item) => item.owner === 'a')!;
    const supplier = host.store.assignments(run.id).find((item) => item.owner === 'b')!;
    const unrelated = host.store.enqueue(run.id, 'c', 'Unrelated current work');
    host.store.updateAssignment(unrelated.id, 'ready', { recordId: 'PRIVATE_RECORD_SENTINEL' });
    const foreign = host.store.createRun('task', ['b'], 'FOREIGN_RUN_SENTINEL');
    host.store.enqueue(foreign.id, 'b', 'FOREIGN_WORK_SENTINEL');
    await host.tick();
    assert.equal(host.store.assignments(run.id).length, 3);
    assert.deepEqual(host.store.assignment(sender.id).dependencies, [supplier.id]);
    assert.equal(host.store.assignment(supplier.id).data.recordId, undefined);
    const record = host.store.assignment(sender.id).data.recordId;
    const retained = JSON.parse(
      readFileSync(join(f.state, 'runs', String(record), 'report.json'), 'utf8'),
    );
    assert.equal(retained.resolvedAssignment.assignment.kind, 'change');
    assert.equal(Object.hasOwn(retained.resolvedAssignment.assignment, 'allowedWritePaths'), false);
    assert.ok(retained.resolvedAssignment.context.at(-1).allowedWritePaths.includes('new.txt'));
    this.evidence(f.calls, run.id, sender.id, supplier.id);
  }

  /** Reads the assigned owner's retained diagnostics before and after evidence continuation. */
  async diagnostics(t: TestContext): Promise<void> {
    const prepared = this.diagnosticAssignment(t);
    const record = this.retainedRecord(prepared.f, prepared.assignment, prepared.recordId);
    const first = await this.assignmentEvidence(prepared, record);
    assert.equal(first.manifest.invocationDiagnostics.recordId, prepared.recordId);
    const continued = await this.assignmentEvidence(prepared, record);
    assert.equal(continued.manifest.assignmentId, prepared.assignment.id);
    assert.deepEqual(continued.diagnostic, first.diagnostic);
    assert.equal(record.operationInvocations.length, 1);
    assert.equal(continued.diagnostic.exitCode, 17);
    assert.deepEqual(continued.diagnostic.resolvedContext, { ownerId: 'a', ownedPaths: ['owned'] });
    assert.equal(continued.log, 'stdout from failed command\nstderr details');
    assert.equal(
      createHash('sha256').update(continued.log).digest('hex'),
      continued.diagnostic.log.sha256,
      'the advertised digest matches the bytes the reference serves',
    );
    assert.equal(continued.diagnostic.log.bytes, Buffer.byteLength(continued.log));
  }

  /** Reads the session's assignment capability and confirms caller references cannot expand it. */
  private async assignmentEvidence(
    prepared: ReturnType<AssignmentRegistryScenario['diagnosticAssignment']>,
    record: ReturnType<AssignmentRegistryScenario['retainedRecord']>,
  ) {
    const execution = new AssignmentExecution(
      prepared.f.state,
      prepared.context,
      prepared.store,
      new AbortController().signal,
    );
    const assignment = prepared.store.assignment(prepared.assignment.id);
    const session = (execution as any).session(assignment, record);
    const pages = (session as any).evidence;
    const manifest = await this.pageJson(pages, 'manifest');
    const index = await this.pageJson(pages, manifest.invocationDiagnostics.artifact);
    const diagnostic = await this.pageJson(pages, index.invocations[0].artifact);
    const log = await this.pageText(pages, diagnostic.log.artifact);
    const foreign = await pages.call('assignment.evidence', {
      artifact: 'foreign-record:invocation:foreign-invocation',
      recordId: 'foreign-record',
    });
    assert.equal(foreign.status, 'rejected');
    return { manifest, diagnostic, log };
  }

  /** Reads a referenced artifact whole, proving the reference resolves to the retained bytes. */
  private async pageText(pages: any, artifact: string): Promise<string> {
    let content = '';
    let offset = 0;
    for (;;) {
      const page = (await pages.call('assignment.evidence', {
        artifact,
        offset,
        length: 1 << 16,
      })) as { content: string; nextOffset: number | null };
      content += page.content;
      if (page.nextOffset === null) return content;
      offset = page.nextOffset;
    }
  }

  /** Reads one complete JSON artifact using only its advertised name in the existing evidence capability. */
  private async pageJson(pages: any, artifact: string) {
    const page = (await pages.call('assignment.evidence', { artifact })) as { content: string };
    return JSON.parse(page.content);
  }

  /** Builds an authoritative assignment and store without launching an external model process. */
  private diagnosticAssignment(t: TestContext) {
    const f = generalCatalogFixture(t);
    const context = new ExecutionContext().resolve(f.repo);
    const store = new ExecutionStore(join(f.state, 'execution.sqlite'));
    t.after(() => store.close());
    const run = store.createRun('task', ['a'], 'Read retained diagnostics');
    const assignment = store.enqueue(run.id, 'a', 'Read my own diagnostics');
    const recordId = randomUUID();
    store.updateAssignment(assignment.id, 'running', { recordId });
    return { f, context, store, run, assignment, recordId };
  }

  /** Writes one identity-matched failed invocation to the assignment's retained record. */
  private retainedRecord(
    f: ReturnType<typeof generalCatalogFixture>,
    assignment: ReturnType<ExecutionStore['assignment']>,
    recordId: string,
  ) {
    const directory = join(f.state, 'runs', recordId);
    mkdirSync(directory, { recursive: true });
    const invocationId = randomUUID();
    const log = join(directory, `invocation-${invocationId}.log`);
    const record = {
      id: recordId,
      ...this.retainedIdentity(f, assignment),
      status: 'failed',
      startedAt: new Date().toISOString(),
      environment: {},
      commands: [],
      operations: [{ id: 'captured-command', log, exitCode: 17 }],
      operationInvocations: [this.retainedInvocation(assignment.id, recordId, invocationId, log)],
      resolvedAssignment: {
        assignment: { kind: 'change' },
        executionProfile: { model: 'test-model' },
      },
    };
    writeFileSync(log, 'stdout from failed command\nstderr details');
    writeFileSync(join(directory, 'report.json'), JSON.stringify(record));
    return record;
  }

  /** Keeps source and workspace identity consistent with the retained assignment record. */
  private retainedIdentity(
    f: ReturnType<typeof generalCatalogFixture>,
    assignment: ReturnType<ExecutionStore['assignment']>,
  ) {
    return {
      executionRunId: assignment.runId,
      assignmentId: assignment.id,
      source: f.repo,
      workspace: f.repo,
      branch: 'test',
      base: 'test',
      commonDir: join(f.repo, '.git'),
    };
  }

  /** Records the original failed invocation's identity, context, status, and output location. */
  private retainedInvocation(
    assignmentId: string,
    recordId: string,
    invocationId: string,
    log: string,
  ) {
    return {
      id: invocationId,
      runId: recordId,
      assignmentId,
      operationId: 'captured-command',
      status: 'failed',
      context: { ownerId: 'a', ownedPaths: ['owned'] },
      result: { exitCode: 17, log },
    };
  }

  /** Proves exact host intent and diagnostic capability were read without exposing foreign-run data. */
  private evidence(path: string, runId: string, sender: string, supplier: string): void {
    const text = readFileSync(path + '.evidence', 'utf8').trim();
    const observed = JSON.parse(text);
    assert.equal(observed.manifest.runId, runId);
    assert.equal(observed.manifest.assignmentId, sender);
    assert.ok(observed.manifest.invocationDiagnostics);
    assert.equal(observed.manifest.records, undefined);
    assert.equal(observed.manifest.assignments.length, 2);
    const entry = observed.manifest.assignments.find((item: any) => item.assignmentId === supplier);
    const intent = JSON.parse(observed.artifacts[entry.artifact]);
    assert.equal(intent.owner, 'b');
    assert.equal(intent.status, 'ready');
    assert.equal(intent.accepted, false);
    assert.equal(intent.objective, 'Supply shared evidence');
    assert.deepEqual(intent.acceptance, ['Evidence-backed result']);
    assert.doesNotMatch(text, /FOREIGN_RUN_SENTINEL|FOREIGN_WORK_SENTINEL/);
    this.canonicalEvidence(observed, runId);
    const intentArtifacts = Object.keys(observed.artifacts).filter((id) => id.endsWith(':intent'));
    const diagnosticArtifacts = Object.keys(observed.artifacts).filter((id) =>
      id.endsWith(':invocations'),
    );
    assert.equal(intentArtifacts.length, 2);
    assert.equal(diagnosticArtifacts.length, 1);
    assert.equal(diagnosticArtifacts[0], observed.manifest.invocationDiagnostics.artifact);
  }

  /** Exposes current-run facts while refusing to dereference a malformed retained record identity. */
  private canonicalEvidence(observed: any, runId: string): void {
    const execution = JSON.parse(observed.artifacts.execution);
    assert.equal(execution.run.id, runId);
    assert.equal(execution.assignments.length, 3);
    const unrelated = execution.assignments.find((item: any) => item.owner === 'c');
    const data = JSON.parse(observed.artifacts[unrelated.data.artifact]);
    assert.equal(data.recordId, 'PRIVATE_RECORD_SENTINEL');
    const record = JSON.parse(observed.artifacts[unrelated.record.artifact]);
    assert.equal(record.evidenceUnavailable, true);
    assert.match(record.reason, /Invalid retained record identity/);
  }
}

const scenarios = new AssignmentRegistryScenario();

nodeTest('engineering evidence provisioning reads retained diagnostics through continuation', (t) =>
  scenarios.diagnostics(t),
);

test('engineering discovers current-run supplier intent and links existing work through MCP', (t) =>
  scenarios.run(t));

test('explicit supplier links retain caller criteria without changing accepted work', (t) =>
  scenarios.callerPurpose(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
