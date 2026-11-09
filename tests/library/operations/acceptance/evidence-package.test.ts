import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { EvidencePackageUpstream } from '../../../../dist/library/operations/evidence-package-upstream.js';
import type { ExternalEffect } from '../../../../dist/library/coordination-store/lifecycle-types.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Drives the evidence-package provider through the public UpstreamProvider shape only. */
class PackageFixture {
  readonly root: string;

  readonly path: string;

  readonly provider: EvidencePackageUpstream;

  /** Creates an isolated package file and one transport spy that must never be touched. */
  constructor(t: TestContext) {
    this.root = mkdtempSync(join(tmpdir(), 'arcnexus-evidence-'));
    this.path = join(this.root, 'evidence-package.jsonl');
    this.provider = new EvidencePackageUpstream(
      'evidence-1',
      'env-1',
      'example/project',
      this.path,
    );
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
  }

  /** Builds a collaboration effect of the shape the engine emits. */
  effect(
    operation: string,
    payload: Record<string, unknown>,
    id = operation + '-1',
  ): ExternalEffect {
    return {
      id,
      operation,
      runId: 'run-1',
      environmentId: 'env-1',
      assignmentId: 'assignment-1',
      target: 'example/project',
      definitionDigest: 'definition',
      input: payload,
      inputDigest: 'input',
      status: 'prepared',
      attempt: 1,
    } as unknown as ExternalEffect;
  }
}

test('evidence package records the real collaboration text in run order', async (t) => {
  const f = new PackageFixture(t);
  const created = await f.provider.apply(
    f.effect('issue.create', { title: 'Ship the gate', body: 'Goal: one clean cycle' }),
    new AbortController().signal,
  );
  const commented = await f.provider.apply(
    f.effect(
      'issue.comment',
      { issueId: String(created.issueId), body: 'Assembly started' },
      'c-1',
    ),
    new AbortController().signal,
  );
  assert.equal(created.simulation, true);
  assert.equal(commented.issueId, created.issueId, 'identity is preserved across operations');
  const lines = readFileSync(f.path, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    lines.map((line) => line.sequence),
    [1, 2],
    'ordering is the run order',
  );
  assert.equal(lines[0].payload.body, 'Goal: one clean cycle', 'captured text is the real text');
  assert.match(lines[0].digest, /^[a-f0-9]{64}$/, 'each record is addressed by digest');
});

test('evidence package reuses the receipt for a repeated effect instead of duplicating it', async (t) => {
  const f = new PackageFixture(t);
  const effect = f.effect('issue.create', { title: 'Once', body: 'Only once' });
  const first = await f.provider.apply(effect, new AbortController().signal);
  const second = await f.provider.apply(effect, new AbortController().signal);
  assert.deepEqual(second, first);
  assert.equal(readFileSync(f.path, 'utf8').trim().split('\n').length, 1);
});

test('evidence package answers recovery lookups with what was captured', async (t) => {
  const f = new PackageFixture(t);
  const absent = await f.provider.inspect(
    f.effect('issue.comment', { issueId: 'x' }, 'never'),
    new AbortController().signal,
  );
  assert.equal(absent.status, 'absent');
  const created = await f.provider.apply(
    f.effect('issue.create', { title: 'Closeable', body: 'A real issue' }, 'close-src'),
    new AbortController().signal,
  );
  const result = await f.provider.apply(
    f.effect('issue.close', { issueId: String(created.issueId), revision: 1 }, 'close-1'),
    new AbortController().signal,
  );
  assert.equal(result.revision, 2, 'a closure advances the state this package recorded');
  const seen = await f.provider.inspect(
    f.effect('issue.close', { issueId: String(created.issueId), revision: 1 }, 'close-1'),
    new AbortController().signal,
  );
  assert.equal(seen.status, 'completed');
  assert.deepEqual(seen.result, result);
});

test('evidence package refuses operations it does not capture instead of claiming success', async (t) => {
  const f = new PackageFixture(t);
  await assert.rejects(
    f.provider.apply(f.effect('release.publish', { tag: 'v1' }), new AbortController().signal),
    /Unsupported evidence-package operation/,
  );
  assert.equal(existsSync(f.path), false, 'a refused operation leaves no record');
});

test('evidence package reaches no upstream and resolves no credential', async (t) => {
  const f = new PackageFixture(t);
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('the evidence provider must never call a remote');
  });
  await f.provider.apply(
    f.effect('issue.create', { title: 'Local', body: 'No remote' }),
    new AbortController().signal,
  );
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(f.provider.mode, 'simulation');
});

test('begun but unreconciled work is unknown, not absent, and cannot be retried silently', async (t) => {
  const f = new PackageFixture(t);
  const effect = f.effect('issue.create', { title: 'Interrupted', body: 'Outcome unclear' }, 'p-1');
  f.provider.markAttempted(effect);
  const seen = await f.provider.inspect(effect, new AbortController().signal);
  assert.equal(seen.status, 'unknown');
  assert.match(seen.reason ?? '', /without a captured result/);
  assert.throws(() => f.provider.markAttempted(effect), /requires reconciliation before retry/);
  const result = await f.provider.apply(effect, new AbortController().signal);
  const after = await f.provider.inspect(effect, new AbortController().signal);
  assert.equal(after.status, 'completed');
  assert.deepEqual(after.result, result, 'the captured result supersedes the marker');
});

test('an effect identity reused with different input is refused, not merged', async (t) => {
  const f = new PackageFixture(t);
  const first = f.effect('issue.comment', { body: 'One' }, 'shared');
  f.provider.markAttempted(first);
  await assert.rejects(
    f.provider.inspect({ ...first, inputDigest: 'different' }, new AbortController().signal),
    /idempotency identity conflict/,
  );
});

test('an effect bound to another environment is refused rather than captured', async (t) => {
  const f = new PackageFixture(t);
  await assert.rejects(
    f.provider.apply(
      {
        ...f.effect('issue.create', { title: 'Foreign', body: 'Elsewhere' }, 'x'),
        environmentId: 'other',
      },
      new AbortController().signal,
    ),
    /bound to another environment/,
  );
  assert.equal(existsSync(f.path), false);
});

registerSuite({ component: 'operations', level: 'acceptance', tags: ['deterministic'] });
