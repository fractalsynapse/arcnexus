import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { LifecycleStore } from '../../../../dist/library/coordination-store/lifecycle-store.js';
import { EvidencePackageUpstream } from '../../../../dist/library/operations/evidence-package-upstream.js';
import { UpstreamExecution } from '../../../../dist/library/operations/upstream-execution.js';
import { UpstreamBridge } from '../../../../dist/library/operations/upstream-bridge.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Uses separate host and provider databases to exercise recovery across the external boundary. */
class UpstreamFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'anx-upstream-'));

  readonly store = new LifecycleStore(join(this.root, 'host.sqlite'));

  readonly provider = new EvidencePackageUpstream(
    'provider',
    'sim',
    'repo',
    join(this.root, 'evidence-package.jsonl'),
  );

  readonly authority = {
    environmentId: 'sim',
    runId: 'run',
    assignmentId: 'assignment',
    authorityDigest: 'authority',
    grants: ['issue.create', 'issue.comment', 'issue.close'].map((operation) => ({
      operation,
      target: 'repo',
      definitionDigest: 'definition',
    })),
  };

  readonly signal = new AbortController().signal;

  readonly executor: UpstreamExecution;

  /** Captures immutable authority and removes only private test evidence. */
  constructor(t: TestContext) {
    this.store.register({
      id: 'sim',
      mode: 'simulation',
      repositoryId: 'repo',
      providerId: 'provider',
      authorityDigest: 'authority',
    });
    this.executor = new UpstreamExecution(this.store, this.provider, this.authority);
    t.after(() => {
      this.store.close();
      rmSync(this.root, { recursive: true, force: true });
    });
  }

  /** Submits a tracking issue through the production effect executor. */
  issue() {
    return this.executor.execute(
      'create',
      'issue.create',
      'repo',
      { title: 'Improve ArcNexus', body: 'Observed acceptance' },
      this.signal,
    );
  }
}

test('simulation issue and comment retries retain one resource per intent', async (t) => {
  const f = new UpstreamFixture(t);
  const issue = await f.issue();
  assert.deepEqual(await f.issue(), issue);
  const input = { issueId: issue.result!.id, body: 'Verified milestone' };
  await f.executor.execute('comment', 'issue.comment', 'repo', input, f.signal);
  await f.executor.execute('comment', 'issue.comment', 'repo', input, f.signal);
  assert.equal(f.provider.entries().length, 2);
  assert.equal(f.store.effect('comment').attempt, 1);
});

test('provider mutation before host receipt reconciles without creating another issue', async (t) => {
  const f = new UpstreamFixture(t);
  const effect = f.store.prepare({
    id: 'create',
    environmentId: 'sim',
    runId: 'run',
    assignmentId: 'assignment',
    operation: 'issue.create',
    target: 'repo',
    definitionDigest: 'definition',
    input: { title: 'Improve ArcNexus', body: 'Observed acceptance' },
  });
  await f.provider.apply(f.store.begin(effect.id), f.signal);
  assert.equal(f.store.effect(effect.id).status, 'uncertain');
  assert.equal((await f.issue()).status, 'uncertain');
  assert.equal((await f.executor.recover(effect.id, f.signal)).status, 'completed');
  assert.equal(f.store.effect(effect.id).attempt, 1);
  assert.equal(f.provider.entries().length, 1);
});

test('mode mismatch fails before mutation', (t) => {
  const f = new UpstreamFixture(t);
  assert.throws(
    () =>
      new UpstreamExecution(
        f.store,
        {
          id: 'provider',
          mode: 'live',
          apply: async () => {
            throw new Error('Must not execute');
          },
          inspect: async () => {
            throw new Error('Must not execute');
          },
        },
        f.authority,
      ),
    /authority/,
  );
  assert.equal(f.provider.entries().length, 0);
});

test('unauthorized destination fails before mutation', async (t) => {
  const f = new UpstreamFixture(t);
  await assert.rejects(
    () =>
      f.executor.execute(
        'bad',
        'issue.create',
        'real-upstream',
        { title: 'Forbidden', body: 'Forbidden' },
        f.signal,
      ),
    /not authorized/,
  );
  assert.equal(f.provider.entries().length, 0);
});

test('stale issue closure rejects atomically and cancellation produces no effect', async (t) => {
  const f = new UpstreamFixture(t);
  const issue = await f.issue();
  await assert.rejects(
    () =>
      f.executor.execute(
        'close',
        'issue.close',
        'repo',
        { issueId: issue.result!.id, revision: 2 },
        f.signal,
      ),
    /Stale/,
  );
  assert.equal(
    f.provider.entries().filter((entry) => entry.operation === 'issue.close').length,
    0,
    'a rejected closure captures nothing',
  );
  assert.equal(f.store.effect('close').status, 'uncertain');
});

test('cancellation stops an effect before it reaches the provider', async (t) => {
  const f = new UpstreamFixture(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () =>
      f.executor.execute(
        'cancelled',
        'issue.create',
        'repo',
        { title: 'No', body: 'No' },
        controller.signal,
      ),
    /abort|cancelled|aborted/i,
  );
  assert.equal(f.provider.entries().length, 0, 'a cancelled effect captures nothing');
});

test('collaboration bridge binds identities and rejects worker authority fields', async (t) => {
  const f = new UpstreamFixture(t);
  const bridge = new UpstreamBridge(f.executor, 'repo', 'run/assignment', f.signal, [
    'issue.create',
    'issue.comment',
  ]);
  const input = { key: 'tracking', title: 'Useful work', body: 'Acceptance' };
  const first = await bridge.call('issue.create', input);
  assert.deepEqual(await bridge.call('issue.create', input), first);
  await assert.rejects(
    () => bridge.call('issue.create', { ...input, owner: 'another' }),
    /host-bound/,
  );
  await assert.rejects(
    () => bridge.call('issue.create', { ...input, body: 'Different' }),
    /different intent/,
  );
  await assert.rejects(() => bridge.call('release.publish', input), /unavailable/);
  assert.equal(f.provider.entries().length, 1);
});

test('recovery cannot declare absence while the upstream request is still active', async (t) => {
  const f = new UpstreamFixture(t);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const provider = {
    id: 'provider',
    mode: 'simulation' as const,
    apply: async () => {
      await pending;
      return { id: 'observed' };
    },
    inspect: f.provider.inspect.bind(f.provider),
  };
  const executor = new UpstreamExecution(f.store, provider, f.authority);
  const result = executor.execute('pending', 'issue.create', 'repo', {}, f.signal);
  try {
    await assert.rejects(() => executor.recover('pending', f.signal), /active upstream/);
    assert.equal(f.store.effect('pending').status, 'uncertain');
  } finally {
    release();
  }
  assert.equal((await result).status, 'completed');
});

registerSuite({
  component: 'operations',
  level: 'integration',
  tags: ['deterministic', 'lifecycle-effects'],
});
