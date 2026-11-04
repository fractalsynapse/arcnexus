import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { CheckedEditBridge } from '../../../../dist/library/assignment/checked-edit-bridge.js';
import { digest } from '../../../../dist/library/architecture/assignment.js';
import type { SessionState } from '../../../../dist/library/assignment/session-state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises host-bound edit authorization independently of agent claims about owner or stage. */
class EditAuthorityScenarios {
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

  /** Observes both batch members so a partial application cannot satisfy the rejection assertions. */
  private contents(state: SessionState): string[] {
    return ['owned/file.ts', 'owned/second.ts'].map((path) =>
      readFileSync(join(state.options.record.workspace, path), 'utf8'),
    );
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
      component: { schemaVersion: 6, allowedWritePaths: ['owned'], fileClassification: [] },
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
