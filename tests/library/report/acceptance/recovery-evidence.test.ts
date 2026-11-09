import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, linkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import {
  AssignmentRegistry,
  EvidenceSet,
  RecoveryEvidence,
} from '../../../../dist/library/report/report.js';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Checks host evidence capabilities independently of model descriptions or private filesystem grants. */
class RecoveryEvidenceScenarios {
  /** Paged captures preserve pending edits and uncertain operations after original evidence changes. */
  async pinned(t: TestContext): Promise<void> {
    const f = this.fixture(t);
    const pages = new RecoveryEvidence(f.root, f.store).capture(f.investigator);
    writeFileSync(join(f.directory, 'checkpoint.json'), 'CHANGED');
    const manifest = JSON.parse(
      ((await pages.call('assignment.evidence', { artifact: 'manifest' })) as any).content,
    );
    assert.equal(manifest.runId, f.run.id);
    assert.equal(manifest.assignmentId, f.investigator.id);
    const state = (await pages.call('assignment.evidence', {
      artifact: 'execution:' + f.source.id + ':record',
    })) as any;
    assert.equal(state.complete, true);
    const operations = (await pages.call(
      'assignment.evidence',
      JSON.parse(state.content).operationInvocations,
    )) as any;
    assert.equal(JSON.parse(operations.content)[0].status, 'interrupted');
    const checkpoint = (await pages.call('assignment.evidence', {
      artifact: f.source.id + ':checkpoint',
    })) as any;
    assert.equal(checkpoint.content, '{"safe":false}');
    const journal = (await pages.call('assignment.evidence', {
      artifact: f.source.id + ':edit:edit.json',
    })) as any;
    assert.equal(JSON.parse(journal.content).status, 'pending');
  }

  /** Malformed pages and identity/path substitutions never grant additional artifact access. */
  async invalid(t: TestContext): Promise<void> {
    const f = this.fixture(t);
    const pages = new RecoveryEvidence(f.root, f.store).capture(f.investigator);
    const large = (await pages.call('assignment.evidence', {
      artifact: 'manifest',
      length: 999999,
    })) as any;
    assert.equal(large.complete, true);
    assert.equal(large.nextOffset, null);
    for (const request of [
      { artifact: 'manifest', length: 0 },
      { artifact: '../report.json' },
      { artifact: 'manifest', runId: 'foreign' },
    ]) {
      const rejected = (await pages.call('assignment.evidence', request)) as any;
      assert.equal(rejected.status, 'rejected');
      assert.equal('content' in rejected, false);
    }
  }

  /** Foreign record identities and filesystem aliases cannot expose contents through a matching assignment. */
  async rejected(t: TestContext, mode: string): Promise<void> {
    const f = this.fixture(t);
    const report = join(f.directory, 'report.json');
    if (mode === 'foreign')
      writeFileSync(
        report,
        JSON.stringify({ ...f.record, executionRunId: randomUUID(), error: 'SECRET' }),
      );
    else {
      rmSync(report);
      const outside = join(f.root, 'outside.json');
      writeFileSync(outside, JSON.stringify({ ...f.record, error: 'SECRET' }));
      if (mode === 'hardlink') linkSync(outside, report);
      else symlinkSync(outside, report);
    }
    const pages = new RecoveryEvidence(f.root, f.store).capture(f.investigator);
    const page = (await pages.call('assignment.evidence', { artifact: 'manifest' })) as any;
    assert.equal(JSON.parse(page.content).records[0].evidenceUnavailable, true);
    assert.doesNotMatch(page.content, /SECRET/);
    const missing = (await pages.call('assignment.evidence', {
      artifact: 'execution:' + f.source.id + ':record',
    })) as any;
    assert.equal(JSON.parse(missing.content).evidenceUnavailable, true);
    assert.doesNotMatch(missing.content, /SECRET/);
    assert.throws(
      () =>
        new RecoveryEvidence(f.root, f.store).capture({ ...f.investigator, runId: randomUUID() }),
      /identity/,
    );
  }

  /** Registers two same-run assignments and one observed incomplete activation without engineering execution. */
  private fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-recovery-evidence-'));
    const store = new ExecutionStore(join(root, 'execution.sqlite'));
    t.after(() => {
      store.close();
      rmSync(root, { recursive: true, force: true });
    });
    const run = store.createRun('task', ['a', 'b'], 'Investigate retained work');
    const source = store.enqueue(run.id, 'a', 'Original work');
    const investigator = store.enqueue(run.id, 'b', 'Review retained evidence');
    const id = randomUUID();
    const directory = join(root, 'runs', id);
    mkdirSync(join(directory, 'checked-edits'), { recursive: true });
    const record = {
      id,
      executionRunId: run.id,
      assignmentId: source.id,
      commands: [],
      operationInvocations: [{ status: 'interrupted' }],
    };
    writeFileSync(join(directory, 'report.json'), JSON.stringify(record));
    writeFileSync(join(directory, 'checkpoint.json'), '{"safe":false}');
    writeFileSync(join(directory, 'checked-edits/edit.json'), '{"status":"pending","changes":[]}');
    store.updateAssignment(source.id, 'failed', { recordId: id });
    return { root, store, run, source, investigator, record, directory };
  }
}

const scenarios = new RecoveryEvidenceScenarios();

test('recovery artifacts remain pinned and reject arbitrary capabilities', (t) =>
  scenarios.pinned(t));

test('recovery evidence rejects malformed pages and host path substitution', (t) =>
  scenarios.invalid(t));

for (const mode of ['foreign', 'symlink', 'hardlink'])
  test(`recovery evidence rejects ${mode} records before serving content`, (t) =>
    scenarios.rejected(t, mode));

/** Characterizes retained invocation diagnostics through the production assignment evidence entry point. */
class InvocationDiagnosticScenarios {
  /** Failed commands retain their observed identities, context and full combined log by reference. */
  async failure(t: TestContext, prerequisite: boolean): Promise<void> {
    const f = this.fixture(t);
    if (prerequisite)
      f.record.operations = [
        { id: 'checkpoint', failedOperationId: 'check', log: f.log, exitCode: 17 },
      ];
    const { pages, diagnostic } = await this.capture(f);
    assert.equal(diagnostic.recordId, f.record.id);
    assert.equal(diagnostic.assignmentId, f.assignment.id);
    assert.equal(diagnostic.invocationId, f.invocation.id);
    assert.equal(diagnostic.operationId, 'check');
    assert.equal(diagnostic.status, 'failed');
    assert.equal(diagnostic.exitCode, 17);
    assert.deepEqual(diagnostic.resolvedContext, f.invocation.context);
    assert.equal(diagnostic.outputComplete, true);
    const output = (await pages.call('assignment.evidence', {
      artifact: diagnostic.log.artifact,
      length: f.content.length + 100,
    })) as any;
    assert.equal(output.content, f.content);
    assert.equal(output.complete, true);
    assert.equal(output.nextOffset, null);
    assert.equal(output.sha256, createHash('sha256').update(f.content).digest('hex'));
    assert.equal(diagnostic.log.sha256, output.sha256);
    assert.equal(diagnostic.log.bytes, Buffer.byteLength(f.content));
    assert.equal(pages.metadata().find((item) => item.id === output.artifact)!.path, f.log);
  }

  /** Missing or contradictory evidence exposes a gap and cannot advertise a successful command log. */
  async gap(t: TestContext, kind: string): Promise<void> {
    const f = this.fixture(t);
    this.corrupt(f, kind);
    const { pages, diagnostic } = await this.capture(f);
    assert.equal(diagnostic.evidenceUnavailable, true);
    assert.match(diagnostic.reason, /unavailable|differs|different|No matching|no retained/);
    assert.equal(diagnostic.exitCode, undefined);
    assert.equal(diagnostic.outputComplete, undefined);
    assert.equal(diagnostic.log, undefined);
    const rejected = (await pages.call('assignment.evidence', {
      artifact: f.assignment.id + ':invocation:' + f.invocation.id + ':log',
    })) as any;
    assert.equal(rejected.status, 'rejected');
    assert.equal('content' in rejected, false);
  }

  /** Interrupted operations retain observed output and status without asserting complete output. */
  async interrupted(t: TestContext): Promise<void> {
    const f = this.fixture(t);
    f.invocation.status = 'interrupted';
    const { diagnostic } = await this.capture(f);
    assert.equal(diagnostic.status, 'interrupted');
    assert.equal(diagnostic.outputComplete, false);
    assert.equal(diagnostic.exitCode, 17);
  }

  /** Persists only fixture observations, then follows the capability's advertised diagnostic index. */
  private async capture(f: ReturnType<InvocationDiagnosticScenarios['fixture']>) {
    writeFileSync(join(f.directory, 'report.json'), JSON.stringify(f.record));
    const pages = new AssignmentRegistry(f.store, f.root).capture(f.assignment);
    const manifest = await this.json(pages, 'manifest');
    assert.equal(manifest.assignmentId, f.assignment.id);
    assert.equal(manifest.invocationDiagnostics.recordId, f.record.id);
    const index = await this.json(pages, manifest.invocationDiagnostics.artifact);
    assert.equal(index.invocations.length, 1);
    const diagnostic = await this.json(pages, index.invocations[0].artifact);
    return { pages, diagnostic };
  }

  /** Reads diagnostic JSON through its public artifact id without touching the retained file directly. */
  private async json(pages: EvidenceSet, artifact: string): Promise<any> {
    const page = (await pages.call('assignment.evidence', { artifact, length: 100000 })) as any;
    assert.equal(page.complete, true);
    return JSON.parse(page.content);
  }

  /** Creates a real durable assignment store with isolated application storage for each scenario. */
  private storage(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-invocation-evidence-'));
    const store = new ExecutionStore(join(root, 'execution.sqlite'));
    t.after(() => {
      store.close();
      rmSync(root, { recursive: true, force: true });
    });
    const run = store.createRun('task', ['report'], 'Inspect retained invocation evidence');
    const assignment = store.enqueue(run.id, 'report', 'Inspect diagnostics');
    const id = randomUUID();
    store.updateAssignment(assignment.id, 'failed', { recordId: id });
    const directory = join(root, 'runs', id);
    mkdirSync(directory, { recursive: true });
    return { root, store, run, assignment: store.assignment(assignment.id), id, directory };
  }

  /** Retains a failed operation absent from command history, with a log larger than the default page. */
  private fixture(t: TestContext) {
    const f = this.storage(t);
    const invocationId = randomUUID();
    const log = join(f.directory, 'invocation-' + invocationId + '.log');
    const content = 'stdout 🙂\nstderr failure detail\n'.repeat(1000) + 'FINAL STDERR\n';
    writeFileSync(log, content);
    const invocation: any = {
      id: invocationId,
      runId: f.id,
      assignmentId: f.assignment.id,
      operationId: 'check',
      status: 'failed',
      context: {
        ownerId: 'report',
        ownedPaths: ['src/library/report'],
        command: 'node',
        args: ['check'],
      },
      result: { exitCode: 17, log },
    };
    const record: any = {
      id: f.id,
      executionRunId: f.run.id,
      assignmentId: f.assignment.id,
      commands: [],
      operations: [{ id: 'check', log, exitCode: 17 }],
      operationInvocations: [invocation],
    };
    return { ...f, log, content, invocation, record };
  }

  /** Removes or contradicts one retained fact while keeping the rest of the captured record intact. */
  private corrupt(f: ReturnType<InvocationDiagnosticScenarios['fixture']>, kind: string): void {
    if (kind === 'missing log') rmSync(f.log);
    else if (kind === 'missing status') delete f.invocation.status;
    else if (kind === 'missing context') delete f.invocation.context;
    else if (kind === 'missing result') delete f.invocation.result;
    else if (kind === 'missing exit') delete f.invocation.result.exitCode;
    else if (kind === 'mismatched exit') f.invocation.result.exitCode = 0;
    else if (kind === 'missing operation') f.record.operations = [];
    else if (kind === 'foreign invocation') f.invocation.assignmentId = randomUUID();
    else if (kind === 'foreign operation') f.invocation.operationId = 'foreign';
    else if (kind === 'unsafe log') {
      rmSync(f.log);
      const outside = join(f.root, 'outside.log');
      writeFileSync(outside, 'FOREIGN OUTPUT');
      symlinkSync(outside, f.log);
    } else throw new Error('Unknown diagnostic scenario: ' + kind);
  }
}

const diagnostics = new InvocationDiagnosticScenarios();

test('assignment diagnostics retain failed invocation context and complete referenced combined logs', (t) =>
  diagnostics.failure(t, false));

test('assignment diagnostics retain failed prerequisite output omitted from command history', (t) =>
  diagnostics.failure(t, true));

test('interrupted invocation diagnostics never assert complete output', (t) =>
  diagnostics.interrupted(t));

for (const kind of [
  'missing log',
  'missing status',
  'missing context',
  'missing result',
  'missing exit',
  'mismatched exit',
  'missing operation',
  'foreign invocation',
  'foreign operation',
  'unsafe log',
])
  test('assignment invocation diagnostics expose an evidence gap for ' + kind, (t) =>
    diagnostics.gap(t, kind),
  );

registerSuite({ component: 'report', level: 'acceptance', tags: ['deterministic', 'recovery'] });
