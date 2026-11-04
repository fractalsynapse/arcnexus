import assert from 'node:assert/strict';
import {
  chmodSync,
  linkSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { CheckedEditBridge } from '../../../../dist/library/assignment/checked-edit-bridge.js';
import { digest } from '../../../../dist/library/architecture/assignment.js';
import type { SessionState } from '../../../../dist/library/assignment/session-state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { OperationEditProposals } from '../../../../dist/library/operations/operations.js';
import { readDiagnosticExcerpt } from '../../../../dist/library/operations/diagnostics.js';

/** Exercises host-bound edit authorization independently of agent claims about owner or stage. */
class EditAuthorityScenarios {
  /** Applies a complete oversized proposal by reference and reuses its receipt without replaying bytes. */
  proposal(t: TestContext): void {
    const state = this.fixture(t);
    state.options.record.stage = 'implementation';
    const bridge = new CheckedEditBridge(state);
    const request = this.request('owned/file.ts');
    request.changes[0]!.content = 'complete-content-'.repeat(3000);
    const reference = this.capture(state, request);
    const log = join(state.dir, `invocation-${reference.proposalInvocationId}.log`);
    assert.equal(readDiagnosticExcerpt(log).truncated, true);
    assert.throws(() => JSON.parse(readDiagnosticExcerpt(log).output));
    writeFileSync(log, 'Later diagnostic contents do not redefine the pinned proposal');
    writeFileSync(
      join(state.dir, `invocation-${reference.proposalInvocationId}.stdout`),
      'Later stdout',
    );
    const receipt = bridge.call('source.edit', reference);
    assert.equal(
      readFileSync(join(state.options.record.workspace, 'owned/file.ts'), 'utf8'),
      request.changes[0]!.content,
    );
    assert.deepEqual(bridge.call('source.edit', reference), receipt);
    assert.equal(readdirSync(join(state.dir, 'checked-edits')).length, 1);
  }

  /** Keeps structured stdout invocation-bound while preserving previously pinned historical references. */
  stdoutIdentity(t: TestContext): void {
    const state = this.fixture(t);
    const reference = this.capture(state, this.request('owned/file.ts'));
    const invocation = (state.options.record.operationInvocations as any[])[0];
    const stdout = invocation.result.stdoutLog;
    const proposals = new OperationEditProposals(state.dir, state.options.record);
    delete invocation.result.stdoutLog;
    assert.equal(proposals.capture(invocation.result), undefined);
    assert.ok(proposals.resolve(reference.proposalInvocationId));
    invocation.result.stdoutLog = invocation.result.log;
    assert.throws(() => proposals.capture(invocation.result), /stdout does not belong/);
    invocation.result.stdoutLog = stdout;
    rmSync(stdout);
    symlinkSync(invocation.result.log, stdout);
    assert.throws(() => proposals.capture(invocation.result), /Unsafe edit proposal/);
  }

  /** A retained proposal cannot bypass current stage, frozen-test or complete-batch ownership checks. */
  proposalAuthority(t: TestContext): void {
    const state = this.fixture(t);
    const bridge = new CheckedEditBridge(state);
    const request = this.request('owned/file.ts');
    const reference = this.capture(state, request);
    state.options.record.stage = 'review';
    assert.throws(() => bridge.call('source.edit', reference), /workflow stage/);
    state.options.record.stage = 'implementation';
    state.frozen = [{ path: 'owned/file.ts', sha256: digest('before'), content: 'before' }];
    assert.throws(() => bridge.call('source.edit', reference), /frozen regression/);
    state.frozen = [];
    request.changes.push({ ...request.changes[0]!, path: 'other/file.ts' });
    const mixed = this.capture(state, request);
    assert.throws(() => bridge.call('source.edit', mixed), /outside active/);
    assert.equal(
      readFileSync(join(state.options.record.workspace, 'owned/file.ts'), 'utf8'),
      'before',
    );
    assert.deepEqual(readdirSync(join(state.dir, 'checked-edits')), []);
  }

  /** Stale, unknown and incomplete references fail without exposing arbitrary files or partial writes. */
  proposalRejection(t: TestContext): void {
    const state = this.fixture(t);
    state.options.record.stage = 'implementation';
    const bridge = new CheckedEditBridge(state);
    const reference = this.capture(state, this.request('owned/file.ts'));
    const invocation = (state.options.record.operationInvocations as any[])[0]!;
    invocation.assignmentId = 'foreign';
    assert.equal((bridge.call('source.edit', reference) as any).status, 'rejected');
    invocation.assignmentId = state.options.record.assignmentId;
    invocation.status = 'running';
    assert.equal((bridge.call('source.edit', reference) as any).status, 'rejected');
    invocation.status = 'completed';
    const path = join(state.options.record.workspace, 'owned/file.ts');
    writeFileSync(path, 'changed');
    assert.equal((bridge.call('source.edit', reference) as any).status, 'rejected');
    assert.equal(
      (bridge.call('source.edit', { proposalInvocationId: '../private' }) as any).status,
      'rejected',
    );
    assert.equal(readFileSync(path, 'utf8'), 'changed');
    assert.deepEqual(readdirSync(join(state.dir, 'checked-edits')), []);
  }

  /** Altered and hard-linked immutable artifacts cannot be consumed as checked-edit requests. */
  proposalIntegrity(t: TestContext): void {
    const state = this.fixture(t);
    state.options.record.stage = 'implementation';
    const bridge = new CheckedEditBridge(state);
    const first = this.capture(state, this.request('owned/file.ts'));
    const path = join(state.dir, 'edit-proposals', first.proposalInvocationId + '.json');
    chmodSync(path, 0o600);
    writeFileSync(path, '{}');
    assert.throws(() => bridge.call('source.edit', first), /evidence changed/);
    const second = this.capture(state, this.request('owned/file.ts'));
    linkSync(
      join(state.dir, 'edit-proposals', second.proposalInvocationId + '.json'),
      join(state.dir, 'alias'),
    );
    assert.throws(() => bridge.call('source.edit', second), /Unsafe edit proposal/);
    assert.equal(
      readFileSync(join(state.options.record.workspace, 'owned/file.ts'), 'utf8'),
      'before',
    );
  }

  /** A symlink replacing a pinned artifact cannot redirect source editing to other retained bytes. */
  proposalSymlink(t: TestContext): void {
    const state = this.fixture(t);
    state.options.record.stage = 'implementation';
    const bridge = new CheckedEditBridge(state);
    const reference = this.capture(state, this.request('owned/file.ts'));
    const path = join(state.dir, 'edit-proposals', reference.proposalInvocationId + '.json');
    rmSync(path);
    symlinkSync(join(state.options.record.workspace, 'owned/file.ts'), path);
    assert.throws(() => bridge.call('source.edit', reference), /Unsafe edit proposal/);
    assert.equal(
      readFileSync(join(state.options.record.workspace, 'owned/file.ts'), 'utf8'),
      'before',
    );
  }

  /** Rejects read-only stages and cross-owner batches before changing any candidate source. */
  stages(t: TestContext): void {
    const state = this.fixture(t);
    const bridge = new CheckedEditBridge(state);
    for (const stage of ['planning', 'review', 'coordination']) {
      state.options.record.stage = stage;
      assert.throws(
        () => bridge.call('source.edit', this.request('owned/file.ts')),
        /workflow stage/,
      );
    }
    state.options.record.stage = 'implementation';
    assert.throws(
      () => bridge.call('source.edit', this.request('other/file.ts')),
      /outside active/,
    );
    state.options.record.readOnlyTurn = true;
    assert.throws(
      () => bridge.call('source.edit', this.request('owned/file.ts')),
      /workflow stage/,
    );
    assert.equal(
      readFileSync(join(state.options.record.workspace, 'owned/file.ts'), 'utf8'),
      'before',
    );
  }

  /** Allows correction through the same tool while retaining the accepted regression baseline. */
  correction(t: TestContext): void {
    const state = this.fixture(t);
    state.options.record.stage = 'correction';
    state.frozen = [
      { path: 'owned/regression.test.ts', sha256: digest('before'), content: 'before' },
    ];
    const bridge = new CheckedEditBridge(state);
    assert.throws(
      () => bridge.call('source.edit', this.request('owned/regression.test.ts')),
      /frozen regression/,
    );
    bridge.call('source.edit', this.request('owned/file.ts'));
    assert.equal(
      readFileSync(join(state.options.record.workspace, 'owned/file.ts'), 'utf8'),
      'after',
    );
  }

  /** Stale batches reject every member and permit a corrected request without aborting the tool scope. */
  stale(t: TestContext): void {
    const state = this.fixture(t);
    state.options.record.stage = 'implementation';
    const bridge = new CheckedEditBridge(state);
    const request = this.request('owned/file.ts');
    writeFileSync(join(state.options.record.workspace, 'owned/second.ts'), 'second');
    request.changes.push({ ...request.changes[0]!, path: 'owned/second.ts' });
    const result = bridge.call('source.edit', request) as any;
    assert.equal(result.status, 'rejected');
    assert.match(result.error, /Stale content hash/);
    assert.equal(result.path, 'owned/second.ts');
    assert.equal(result.expectedSha256, digest('before'));
    assert.equal(result.currentSha256, digest('second'));
    assert.deepEqual(this.contents(state), ['before', 'second']);
    assert.deepEqual(readdirSync(join(state.dir, 'checked-edits')), []);
    request.changes[1]!.expectedSha256 = digest('second');
    assert.equal((bridge.call('source.edit', request) as any).status, 'committed');
    assert.deepEqual(this.contents(state), ['after', 'after']);
    assert.equal(readdirSync(join(state.dir, 'checked-edits')).length, 1);
  }

  /** Distinct edits cannot reuse an identity, while original receipts never replay earlier bytes. */
  identities(t: TestContext): void {
    const state = this.fixture(t);
    state.options.record.stage = 'implementation';
    const bridge = new CheckedEditBridge(state);
    const original = this.request('owned/file.ts');
    const receipt = bridge.call('source.edit', original);
    const next = {
      ...original,
      changes: [
        {
          ...original.changes[0]!,
          expectedSha256: digest('after'),
          content: 'later',
        },
      ],
    };
    const rejected = bridge.call('source.edit', next) as any;
    assert.equal(rejected.status, 'rejected');
    assert.match(rejected.recovery, /fresh.*ID/i);
    const path = join(state.options.record.workspace, 'owned/file.ts');
    assert.equal(readFileSync(path, 'utf8'), 'after');
    assert.equal(readdirSync(join(state.dir, 'checked-edits')).length, 1);
    next.id = 'another-edit';
    assert.equal((bridge.call('source.edit', next) as any).status, 'committed');
    assert.deepEqual(bridge.call('source.edit', original), receipt);
    assert.equal(readFileSync(path, 'utf8'), 'later');
    assert.equal(readdirSync(join(state.dir, 'checked-edits')).length, 2);
  }

  /** Malformed request syntax rejects the whole batch and allows correction without granting source authority. */
  malformed(t: TestContext): void {
    const state = this.fixture(t);
    state.options.record.stage = 'implementation';
    const bridge = new CheckedEditBridge(state);
    const request: any = this.request('owned/file.ts');
    delete request.changes[0].content;
    const result = bridge.call('source.edit', request) as any;
    assert.equal(result.status, 'rejected');
    assert.match(result.error, /content/);
    assert.match(result.recovery, /complete replacement content/);
    assert.equal(
      readFileSync(join(state.options.record.workspace, 'owned/file.ts'), 'utf8'),
      'before',
    );
    assert.deepEqual(readdirSync(join(state.dir, 'checked-edits')), []);
    request.changes[0].content = 'after';
    assert.equal((bridge.call('source.edit', request) as any).status, 'committed');
    assert.equal(
      readFileSync(join(state.options.record.workspace, 'owned/file.ts'), 'utf8'),
      'after',
    );
  }

  /** Rejects metadata changes atomically, then permits corrected bodies and a new owned suite. */
  capturedSelection(t: TestContext): void {
    const state = this.fixture(t);
    state.options.record.stage = 'implementation';
    const metadata = {
      component: 'assignment',
      level: 'acceptance' as const,
      tags: ['native-host'],
    };
    const original = `registerSuite(${JSON.stringify(metadata)});`;
    writeFileSync(join(state.options.record.workspace, 'owned/second.ts'), original);
    state.component.capturedTests = [
      { ...metadata, source: 'owned/second.ts', sha256: digest(original) },
    ];
    const bridge = new CheckedEditBridge(state);
    for (const change of [
      { ...metadata, component: 'other' },
      { ...metadata, level: 'unit' },
      { ...metadata, tags: [] },
      { ...metadata, tags: ['native-host', 'regression'] },
    ])
      this.rejectSelection(state, bridge, original, `registerSuite(${JSON.stringify(change)});`);
    this.rejectSelection(state, bridge, original, null);
    this.rejectSelection(state, bridge, original, '// registration removed');
    this.correctSelection(bridge, original);
  }

  /** Applies changed test bodies and new suites without changing the captured suite selection. */
  private correctSelection(bridge: CheckedEditBridge, original: string): void {
    const request = this.request('owned/file.ts');
    request.changes.push({
      path: 'owned/second.ts',
      operation: 'update',
      expectedSha256: digest(original),
      content: original + '\n// improved body',
    });
    assert.equal((bridge.call('source.edit', request) as any).status, 'committed');
    const added = {
      path: 'owned/tests/acceptance/new.test.ts',
      operation: 'create',
      expectedSha256: null,
      content: original,
    };
    const result = bridge.call('source.edit', { id: 'new-suite', changes: [added] }) as any;
    assert.equal(result.status, 'committed');
  }

  /** Checks every member and the journal after rejection, including explicit suite deletion. */
  private rejectSelection(
    state: SessionState,
    bridge: CheckedEditBridge,
    original: string,
    content: string | null,
  ): void {
    const request: any = this.request('owned/file.ts');
    request.changes.push({
      path: 'owned/second.ts',
      operation: content === null ? 'delete' : 'update',
      expectedSha256: digest(original),
      content,
    });
    const result = bridge.call('source.edit', request) as any;
    assert.equal(result.status, 'rejected');
    assert.match(result.error, /captured test selection/);
    assert.deepEqual(this.contents(state), ['before', original]);
    assert.deepEqual(readdirSync(join(state.dir, 'checked-edits')), []);
  }

  /** Observes both batch members so a partial application cannot satisfy the rejection assertions. */
  private contents(state: SessionState): string[] {
    return ['owned/file.ts', 'owned/second.ts'].map((path) =>
      readFileSync(join(state.options.record.workspace, path), 'utf8'),
    );
  }

  /** Captures complete output at the observed-operation boundary; source editing stays production code. */
  private capture(state: SessionState, request: unknown) {
    mkdirSync(state.dir, { recursive: true });
    const id = randomUUID();
    const log = join(state.dir, `invocation-${id}.log`);
    const stdoutLog = join(state.dir, `invocation-${id}.stdout`);
    writeFileSync(stdoutLog, JSON.stringify(request));
    writeFileSync(log, JSON.stringify(request) + '\nDiagnostic warning on stderr\n');
    const result: any = { exitCode: 0, log, stdoutLog };
    state.options.record.operationInvocations ??= [];
    (state.options.record.operationInvocations as any[]).push({
      id,
      runId: state.options.record.id,
      assignmentId: state.options.record.assignmentId,
      purpose: 'agent',
      status: 'completed',
      result,
    });
    const proposal = new OperationEditProposals(state.dir, state.options.record).capture(result);
    assert.equal(proposal?.invocationId, id);
    return { proposalInvocationId: id };
  }

  /** Creates a minimal host state with authority unavailable to the incoming edit arguments. */
  private fixture(t: TestContext): SessionState {
    const root = mkdtempSync(join(tmpdir(), 'edit-authority-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const workspace = join(root, 'source');
    mkdirSync(join(workspace, 'owned'), { recursive: true });
    writeFileSync(join(workspace, 'owned/file.ts'), 'before');
    const resolved = { digest: 'captured-authority' };
    return {
      options: { record: { workspace, id: 'run', resolvedAssignment: resolved } },
      dir: join(root, 'evidence'),
      resolved,
      scope: ['owned'],
      assignment: { kind: 'change' },
      frozen: [],
      component: {
        schemaVersion: 6,
        id: 'assignment',
        repositoryRoot: 'owned',
        testProfile: 'node',
        allowedWritePaths: ['owned'],
        fileClassification: [],
      },
      journal: () => {},
      safe: () => {},
    } as unknown as SessionState;
  }

  /** Supplies content expectations without any owner or authority override. */
  private request(path: string) {
    return {
      id: 'edit',
      changes: [{ path, operation: 'update', expectedSha256: digest('before'), content: 'after' }],
    };
  }
}

const scenarios = new EditAuthorityScenarios();

test('captured suite selection rejects complete batches before mutation and permits corrected retries', (t) =>
  scenarios.capturedSelection(t));

test('oversized operation proposals apply complete bytes through the checked edit bridge', (t) =>
  scenarios.proposal(t));

test('operation proposals bind safe stdout and preserve pinned historical evidence', (t) =>
  scenarios.stdoutIdentity(t));

test('operation proposals retain stage, frozen-test and atomic ownership enforcement', (t) =>
  scenarios.proposalAuthority(t));

test('operation proposals reject stale, foreign and incomplete references', (t) =>
  scenarios.proposalRejection(t));

test('operation proposal evidence rejects tampering and aliases', (t) =>
  scenarios.proposalIntegrity(t));

test('operation proposal evidence rejects symlink replacement', (t) =>
  scenarios.proposalSymlink(t));

test('checked edit bridge enforces bound owner and workflow stage', (t) => scenarios.stages(t));

test('checked edit bridge permits correction while freezing accepted regression', (t) =>
  scenarios.correction(t));

test('stale checked edits return rejection and permit a corrected atomic batch', (t) =>
  scenarios.stale(t));

test('checked edit identity conflicts recover without replacing or replaying prior transactions', (t) =>
  scenarios.identities(t));

test('malformed checked edit input is correctable without source mutation or weakened authority', (t) =>
  scenarios.malformed(t));

registerSuite({ component: 'assignment', level: 'acceptance', tags: ['deterministic'] });
