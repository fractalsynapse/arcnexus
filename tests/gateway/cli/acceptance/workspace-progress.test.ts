import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { RunQueryFixture } from '../support/run-query-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Seeds retained historical evidence without a source checkout or active execution host. */
class WorkspaceProgressFixture extends RunQueryFixture {
  readonly directory = join(this.state, 'runs', 'retained');

  readonly recordPath = join(this.directory, 'report.json');

  private sequence = 0;

  /** Writes only the minimum receipt needed to exercise historical resource projection. */
  constructor(t: TestContext) {
    super(t);
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(
      this.recordPath,
      JSON.stringify({
        id: 'retained',
        source: '/unavailable-source',
        workspace: join(this.state, 'workspaces', 'retained'),
        status: 'running',
        startedAt: '2026-01-01T00:00:00Z',
        turns: ['private-secret'],
        bindings: { secret: 'private-secret' },
      }),
    );
  }

  /** Adds captured fields while preserving the original historical identity. */
  patch(fields: object): void {
    const record = JSON.parse(readFileSync(this.recordPath, 'utf8'));
    writeFileSync(this.recordPath, JSON.stringify({ ...record, ...fields }));
  }

  /** Appends real timeline envelopes without rewriting the report, modeling a mid-operation read. */
  event(type: string, payload: unknown): void {
    appendFileSync(
      join(this.directory, 'timeline.jsonl'),
      JSON.stringify({
        schemaVersion: 1,
        sequence: ++this.sequence,
        runId: 'retained',
        observedAt: '2026-01-01T00:00:00Z',
        type,
        payload,
      }) + '\n',
    );
  }

  /** Reads through the built public CLI from an unrelated directory. */
  view(): any {
    return this.value('workspace', 'get', 'retained');
  }
}

test('workspace progress preserves historical unknowns without exposing private record fields', (t) => {
  const f = new WorkspaceProgressFixture(t);
  const before = readFileSync(f.recordPath);
  const result = f.view();
  assert.equal(result.progress.stage, 'unavailable');
  assert.equal(result.progress.checklist.total, null);
  assert.equal(result.progress.lastVerified, null);
  assert.equal(result.progress.currentCommand, null);
  assert.equal(result.timeline.complete, false);
  assert.equal(JSON.stringify(result).includes('private-secret'), false);
  assert.deepEqual(readFileSync(f.recordPath), before);
});

test('workspace progress separates checklist claims from recorded host evidence and old limits', (t) => {
  const f = new WorkspaceProgressFixture(t);
  f.patch({
    stage: 'implementation',
    cancellation: 'requested',
    executionLimits: { maxTurns: 7 },
    plan: { version: 2, items: [{ id: 'one', status: 'completed' }], hostChecks: ['verify'] },
    progress: { lastVerified: { at: 'captured-time', evidence: { operationId: 'verify' } } },
  });
  const { progress } = f.view();
  assert.equal(progress.checklist.completed, 1);
  assert.equal(progress.checklist.basis, 'agent claims; host checks reported separately');
  assert.deepEqual(progress.lastVerified.evidence, { operationId: 'verify' });
  assert.deepEqual(progress.hostChecks, ['verify']);
  assert.equal(progress.limits.maxTurns, 7);
  assert.equal(progress.cancellation, 'requested');
});

test('event-only command changes update workspace revisions consistently across list and get', (t) => {
  const f = new WorkspaceProgressFixture(t);
  const initial = f.view();
  f.event('operation.started', { id: 'verify', private: 'private-secret' });
  const running = f.view();
  assert.equal(running.progress.currentCommand, 'verify');
  assert.notEqual(running.revision, initial.revision);
  assert.equal(f.view().revision, running.revision);
  assert.equal(f.value('workspace', 'list').items[0].revision, running.revision);
  assert.equal(JSON.stringify(running).includes('private-secret'), false);
  f.event('operation.finished', { id: 'verify', result: { exitCode: 0 } });
  const finished = f.view();
  assert.equal(finished.progress.currentCommand, null);
  assert.notEqual(finished.revision, running.revision);
  assert.equal(finished.workspace.revision, finished.revision);
});

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic', 'resources'] });

test('retired observation spellings explain resource replacements without creating state', (t) => {
  const f = new RunQueryFixture(t);
  for (const command of ['status', 'follow', 'prepare', 'cleanup']) {
    const result = f.command(command, 'retained');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /is retired; use workspace (get|prepare|cleanup)/);
    if (command === 'follow') assert.match(result.stderr, /--follow/);
  }
  assert.equal(existsSync(f.state), false);
  assert.deepEqual(f.value('workspace', 'list').items, []);
});
