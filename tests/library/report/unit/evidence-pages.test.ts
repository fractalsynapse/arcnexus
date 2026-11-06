import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, chmodSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { test, type TestContext } from 'node:test';
import { AssignmentRegistry, EvidencePages } from '../../../../dist/library/report/report.js';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import type { RecordData } from '../../../../dist/library/workspace/state.js';

/** Exercises client correction and retained invocation reader behavior without widening access. */
class EvidenceRequestScenarios {
  /** Large details stay losslessly paged while the index fits in one read and preserves missing evidence. */
  async sections(): Promise<void> {
    const pages = this.pages();
    const original = { status: 'failed', output: 'evidence'.repeat(10000), missing: null };
    const reference = pages.addSections('record', original, ['output', 'missing', 'absent']);
    const result = (await pages.call('verification.evidence', reference)) as any;
    assert.equal(result.complete, true);
    const index = JSON.parse(result.content);
    assert.equal(index.status, 'failed');
    assert.equal('absent' in index, false);
    let output = '',
      offset = 0;
    do {
      const page = (await pages.call('verification.evidence', { ...index.output, offset })) as any;
      output += page.content;
      offset = page.nextOffset;
      if (page.complete) break;
    } while (offset < JSON.stringify(original.output).length);
    assert.equal(JSON.parse(output), original.output);
    const missing = (await pages.call('verification.evidence', index.missing)) as any;
    assert.equal(missing.content, 'null');
    assert.equal(typeof original.output, 'string');
    assert.equal(pages.metadata().filter((item) => item.id === index.output.artifact).length, 1);
  }

  /** Agent-selected large reads preserve exact content and can consume the remaining artifact at once. */
  async large(): Promise<void> {
    const pages = this.pages();
    const original = 'evidence'.repeat(30000);
    pages.add('large', original, 'utf8');
    const first = (await pages.call('verification.evidence', {
      artifact: 'large',
      length: 100000,
    })) as any;
    assert.equal(first.content, original.slice(0, 100000));
    assert.equal(first.nextOffset, 100000);
    assert.equal(first.complete, false);
    const rest = (await pages.call('verification.evidence', {
      artifact: 'large',
      offset: first.nextOffset,
      length: Number.MAX_SAFE_INTEGER,
    })) as any;
    assert.equal(first.content + rest.content, original);
    assert.equal(rest.complete, true);
    assert.equal(rest.nextOffset, original.length);
    assert.equal(rest.sha256, first.sha256);
    const schema = pages.tools[0]!.inputSchema as any;
    assert.equal('maximum' in schema.properties.length, false);
    for (const length of [0, -1, 1.5, '100000', Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const result = (await pages.call('verification.evidence', {
        artifact: 'large',
        length,
      })) as any;
      assert.equal(result.status, 'rejected');
    }
  }

  /** Rejects malformed and foreign inputs without disclosure, then serves unchanged pinned content. */
  async corrective(capability: string): Promise<void> {
    const pages = this.pages(capability);
    for (const request of [
      null,
      [],
      'manifest',
      {},
      { artifact: 1 },
      { artifact: '' },
      { artifact: 'manifest', runId: 'foreign' },
      { artifact: '../report.json' },
      { artifact: 'supplier:edit:foreign.json' },
    ]) {
      const result = (await pages.call(capability, request)) as any;
      assert.equal(result.status, 'rejected');
      assert.equal('content' in result, false);
      assert.equal('sha256' in result, false);
      assert.match(result.recovery, /artifact=manifest/);
    }
    const page = (await pages.call(capability, { artifact: 'manifest' })) as any;
    assert.equal(page.content, '{"captured":true}');
    assert.equal(page.complete, true);
    await assert.rejects(pages.call('foreign.evidence', { artifact: 'manifest' }), /capability/);
  }

  /** Altered retained content still raises an integrity error rather than a correctable input rejection. */
  integrity(t: TestContext): void {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-evidence-request-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const pages = this.pages();
    const retained = pages.retain(root, {}) as { directory: string; manifest: string };
    const path = join(retained.directory, retained.manifest);
    assert.equal(readFileSync(path, 'utf8'), '{"captured":true}');
    chmodSync(path, 0o600);
    writeFileSync(path, 'TAMPERED');
    assert.throws(() => pages.retain(root, {}), /content identity/);
  }

  /** Pages full failed command output with retained identity and resolved invocation context. */
  async diagnostics(t: TestContext): Promise<void> {
    const fixture = this.diagnosticFixture(t, 'valid');
    const pages = new AssignmentRegistry(fixture.store, fixture.root).capture(fixture.assignment);
    const manifest = await this.page(pages, 'manifest');
    const index = await this.page(pages, manifest.invocationDiagnostics.artifact);
    const reference = index.invocations[0];
    const diagnostic = JSON.parse(await this.complete(pages, reference.artifact));
    assert.equal(diagnostic.recordId, fixture.recordId);
    assert.equal(diagnostic.assignmentId, fixture.assignmentId);
    assert.equal(diagnostic.invocationId, fixture.invocationId);
    assert.equal(diagnostic.operationId, 'compile');
    assert.equal(diagnostic.exitCode, 7);
    assert.deepEqual(diagnostic.resolvedContext, { ownerId: 'report' });
    assert.equal(diagnostic.combinedOutput, 'stdout detail\nstderr detail\n');
  }

  /** Missing records, logs, and foreign paths remain pageable gaps without leaking private paths. */
  async inaccessible(t: TestContext): Promise<void> {
    for (const kind of ['missing', 'foreign', 'missing-record']) {
      const fixture = this.diagnosticFixture(t, kind);
      const pages = new AssignmentRegistry(fixture.store, fixture.root).capture(fixture.assignment);
      const manifest = await this.page(pages, 'manifest');
      const index = await this.page(pages, manifest.invocationDiagnostics.artifact);
      if (kind === 'missing-record') {
        assert.equal(index.evidenceUnavailable, true);
        assert.equal(index.reason, 'Retained record is unavailable or unsafe');
        assert.equal(JSON.stringify(index).includes(fixture.root), false);
        continue;
      }
      const diagnostic = JSON.parse(await this.complete(pages, index.invocations[0].artifact));
      assert.equal(diagnostic.evidenceUnavailable, true);
      assert.equal(diagnostic.reason, 'Retained invocation output is unavailable or unsafe');
      assert.equal(JSON.stringify(diagnostic).includes(fixture.root), false);
      assert.doesNotMatch(JSON.stringify(diagnostic), /FOREIGN_LOG_SENTINEL/);
    }
  }

  /** Builds a real temporary store, report, operation record, invocation journal, and retained log. */
  private diagnosticFixture(t: TestContext, kind: string) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-invocation-evidence-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const store = new ExecutionStore(join(root, 'diagnostics.sqlite'));
    t.after(() => store.close());
    const run = store.createRun('task', ['report'], 'Inspect retained diagnostics');
    const assignment = store.enqueue(run.id, 'report', 'Read command diagnostics');
    const recordId = randomUUID();
    const directory = join(root, 'runs', recordId);
    mkdirSync(directory, { recursive: true });
    const invocationId = randomUUID();
    if (kind !== 'missing-record')
      this.writeDiagnosticRecord(directory, run.id, assignment.id, recordId, invocationId, kind);
    store.updateAssignment(assignment.id, 'ready', { recordId });
    return { root, store, run, assignment, recordId, assignmentId: assignment.id, invocationId };
  }

  /** Persists production-shaped operations and canonical invocation records with selected log state. */
  private writeDiagnosticRecord(
    directory: string,
    runId: string,
    assignmentId: string,
    recordId: string,
    invocationId: string,
    kind: string,
  ): void {
    const normalLog = join(directory, 'invocation-' + invocationId + '.log');
    const log = kind === 'foreign' ? join(directory, '..', 'foreign.log') : normalLog;
    if (kind !== 'missing')
      writeFileSync(
        log,
        kind === 'foreign' ? 'FOREIGN_LOG_SENTINEL' : 'stdout detail\nstderr detail\n',
      );
    const record = this.record(runId, assignmentId, recordId, invocationId, log);
    writeFileSync(join(directory, 'report.json'), JSON.stringify(record));
  }

  /** Forms the exact retained operation and invocation fields produced by the runtime. */
  private record(
    runId: string,
    assignmentId: string,
    recordId: string,
    invocationId: string,
    log: string,
  ): RecordData {
    return {
      id: recordId,
      executionRunId: runId,
      assignmentId,
      commands: [],
      operations: [{ id: 'compile', exitCode: 7, failedOperationId: 'compile', log }],
      operationInvocations: [
        {
          id: invocationId,
          operationId: 'compile',
          runId: recordId,
          assignmentId,
          context: { ownerId: 'report' },
          status: 'failed',
          result: { exitCode: 7, log },
        },
      ],
    } as unknown as RecordData;
  }

  /** Reads JSON artifact content through the existing assignment capability. */
  private async page(
    pages: { call(name: string, args: unknown): Promise<unknown> },
    artifact: string,
  ): Promise<any> {
    const response = (await pages.call('assignment.evidence', { artifact })) as { content: string };
    return JSON.parse(response.content);
  }

  /** Follows bounded offsets until the complete pinned artifact has been read. */
  private async complete(pages: EvidencePages, artifact: string): Promise<string> {
    let offset = 0;
    let content = '';
    while (true) {
      const page = (await pages.call('assignment.evidence', {
        artifact,
        offset,
        length: 64,
      })) as any;
      assert.equal(page.status, undefined);
      content += page.content;
      offset = page.nextOffset;
      if (page.complete) return content;
    }
  }

  /** Creates an existing evidence capability for malformed-reference coverage. */
  private pages(capability = 'verification.evidence'): EvidencePages {
    const pages = new EvidencePages(capability);
    pages.add('manifest', '{"captured":true}', 'json');
    return pages;
  }
}

const scenarios = new EvidenceRequestScenarios();

test('evidence reads have no artificial page size ceiling', () => scenarios.large());

test('section indexes keep large evidence available without inline duplication', () =>
  scenarios.sections());

test('verification evidence request mistakes remain correctable without disclosure', () =>
  scenarios.corrective('verification.evidence'));

test('assignment evidence request mistakes are correctable without disclosure', () =>
  scenarios.corrective('assignment.evidence'));

test('evidence request correction does not swallow retained integrity failures', (t) =>
  scenarios.integrity(t));

test('assignment evidence pages complete retained invocation diagnostics', (t) =>
  scenarios.diagnostics(t));

test('missing and foreign invocation logs remain explicit evidence gaps', (t) =>
  scenarios.inaccessible(t));

registerSuite({ component: 'report', level: 'unit', tags: ['deterministic', 'evidence'] });
