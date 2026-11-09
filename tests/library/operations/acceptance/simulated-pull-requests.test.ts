import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { SimulatedReleases } from '../../../../dist/library/operations/simulated-releases.js';
import { git } from '../../../../dist/library/operations/process.js';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ProviderStore } from '../../../../dist/library/coordination-store/provider-store.js';
import { SimulatedPullRequests } from '../../../../dist/library/operations/simulated-pull-requests.js';
import { UpstreamExecution } from '../../../../dist/library/operations/upstream-execution.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { GitDeliveryFixture } from '../../testing/support/delivery-fixture.js';

/** Combines actual Git delivery with controlled check outcomes at the host-check boundary. */
class PullRequestFixture {
  readonly git: GitDeliveryFixture;

  readonly store: ProviderStore;

  readonly provider: SimulatedPullRequests;

  readonly executor: UpstreamExecution;

  result: 'passed' | 'failed' | 'interrupted' = 'failed';

  checks = 0;

  artifacts: Array<{ path: string; sha256: string }> = [];

  /** When false the gate reports only the candidate's own record, as an unaudited check would. */
  reviewerCoverage = true;

  readonly reviewedHeads: Array<{ head: string; independent: boolean }> = [];

  private readonly authority = {
    environmentId: 'sim',
    runId: 'run',
    authorityDigest: 'authority',
    grants: [
      'pull-request.create',
      'pull-request.check',
      'pull-request.merge',
      'release.create',
    ].map((operation) => ({ operation, target: 'repo', definitionDigest: 'policy' })),
  };

  /** Keeps controlled check inputs inside acceptance and captures durable provider state separately. */
  constructor(t: TestContext) {
    this.git = new GitDeliveryFixture(t);
    this.store = new ProviderStore(join(this.git.root, 'provider.sqlite'));
    t.after(() => this.store.close());
    this.provider = new SimulatedPullRequests(
      this.git.store.get(this.git.id),
      this.store,
      this.git.provider,
      (head, signal, independent) => this.check(head, signal, independent),
    );
    this.executor = new UpstreamExecution(
      this.git.effects,
      {
        id: 'provider',
        mode: 'simulation',
        apply: (effect, signal) =>
          (effect.operation === 'release.create' ? this.releases() : this.provider).apply(
            effect,
            signal,
          ),
        inspect: async (effect) =>
          (effect.operation === 'release.create' ? this.releases() : this.provider).inspect(effect),
      },
      this.authority,
    );
  }

  /** Shares the same private provider state with content-addressed release artifact storage. */
  releases() {
    return new SimulatedReleases(
      this.git.store.get(this.git.id),
      this.store,
      join(this.git.root, 'artifacts'),
    );
  }

  /** Returns explicit controlled outcomes and counts attempts at the declared host-check boundary. */
  private async check(head: string, signal: AbortSignal, independent = false) {
    signal.throwIfAborted();
    this.checks++;
    this.reviewedHeads.push({ head, independent });
    if (this.result === 'interrupted') throw new Error('Controlled check interruption');
    return {
      status: this.result,
      evidence: [
        'Controlled host check boundary',
        ...(this.reviewerCoverage && independent ? ['Independent reviewer coverage'] : []),
      ],
      artifacts: this.artifacts,
    };
  }

  /** Creates actual local commit/push effects before any simulated PR may exist. */
  async prepare(): Promise<void> {
    await this.git.execute('delivery.commit');
    await this.git.execute('delivery.push');
    await this.execute('create', 'pull-request.create');
  }

  /** Captures the observed target once and reuses that intent after integration changes the target. */
  merge() {
    const existing = this.git.effects.effects().find((effect) => effect.id === 'merge');
    const input = existing?.input ?? {
      deliveryId: this.git.id,
      targetHead: this.git.provider.targetHead(),
    };
    return this.executor.execute('merge', 'pull-request.merge', 'repo', input, this.git.signal);
  }

  /** Supplies stable host-scoped intent without allowing arbitrary branch or candidate substitution. */
  execute(id: string, operation: string, decision?: string) {
    return this.executor.execute(
      id,
      operation,
      'repo',
      {
        deliveryId: this.git.id,
        ...(operation === 'pull-request.create'
          ? this.git.store.get(this.git.id).publicationDocument
          : {}),
        ...(decision ? { decision } : {}),
      },
      this.git.signal,
    );
  }
}

test('simulated PRs merge only with passing checks backed by reviewer coverage', async (t) => {
  const f = new PullRequestFixture(t);
  await f.prepare();
  const document = f.git.store.get(f.git.id).publicationDocument!;
  const resource = f.store.resources().find((item) => item.kind === 'pull_request')!;
  assert.equal(resource.data.title, document.title);
  assert.equal(resource.data.body, document.body);
  const failed = await f.execute('failed-check', 'pull-request.check');
  assert.equal(failed.result!.checks, 'failed');
  assert.throws(() => f.provider.ready(f.git.effects.effect('review')), /passing checks/);
  f.result = 'passed';
  const passed = await f.execute('passed-check', 'pull-request.check');
  const ready = f.provider.ready(passed);
  assert.ok(
    Array.isArray(ready.data.reviewerEvidence) && ready.data.reviewerEvidence.length,
    'the one independent gate supplies reviewer coverage',
  );
  assert.equal(ready.data.checkHead, ready.data.head);
  assert.deepEqual(await f.execute('passed-check', 'pull-request.check'), passed);
  assert.equal(f.checks, 2);
});

test('interrupted simulated checks retain uncertainty and are never silently replayed', async (t) => {
  const f = new PullRequestFixture(t);
  await f.prepare();
  f.result = 'interrupted';
  await assert.rejects(() => f.execute('check', 'pull-request.check'), /interruption/);
  const recovered = await f.executor.recover('check', f.git.signal);
  assert.equal(recovered.status, 'uncertain');
  assert.equal((await f.execute('check', 'pull-request.check')).status, 'uncertain');
  assert.equal(f.checks, 1);
  assert.equal(f.store.resources()[0]!.data.checks, 'pending');
});

test('passing checks without reviewer coverage cannot satisfy the merge gate', async (t) => {
  const f = new PullRequestFixture(t);
  await f.prepare();
  f.result = 'passed';
  f.reviewerCoverage = false;
  await f.execute('check', 'pull-request.check');
  assert.throws(() => f.provider.ready(f.git.effects.effect('check')), /reviewer coverage/);
});

test('simulated merge integrates the actual assembled tree only after fresh independent assessment', async (t) => {
  const f = new PullRequestFixture(t);
  await f.prepare();
  f.result = 'passed';
  await f.execute('check', 'pull-request.check');
  const prior = f.git.provider.targetHead();
  const merged = await f.merge();
  assert.equal(merged.result!.merged, true);
  assert.equal(f.git.provider.targetHead(), merged.result!.head);
  assert.notEqual(merged.result!.head, prior);
  assert.equal(
    git(f.git.repository.origin, 'show', `${String(merged.result!.head)}:source.txt`),
    'reviewed candidate',
  );
  assert.deepEqual(f.reviewedHeads.at(-1), { head: merged.result!.head, independent: true });
  assert.equal(f.store.resources()[0]!.data.state, 'merged');
  assert.deepEqual(await f.merge(), merged);
});

test('failed assembled checks leave the target unchanged and report an unmerged outcome', async (t) => {
  const f = new PullRequestFixture(t);
  await f.prepare();
  f.result = 'passed';
  await f.execute('check', 'pull-request.check');
  const prior = f.git.provider.targetHead();
  f.result = 'failed';
  const refused = await f.merge();
  assert.equal(refused.result!.merged, false);
  assert.equal(f.git.provider.targetHead(), prior);
  assert.equal(f.store.resources()[0]!.data.state, 'open');
});

test('simulated release retains actual merged-check artifacts and deduplicates its receipt', async (t) => {
  const f = new PullRequestFixture(t);
  await f.prepare();
  const path = join(f.git.root, 'built-artifact');
  writeFileSync(path, 'controlled build artifact bytes');
  const sha256 = createHash('sha256').update(readFileSync(path)).digest('hex');
  f.artifacts = [{ path, sha256 }];
  f.result = 'passed';
  await f.execute('check', 'pull-request.check');
  await f.merge();
  const release = await f.execute('release', 'release.create');
  const artifacts = release.result!.artifacts as Array<{ path: string; sha256: string }>;
  assert.equal(readFileSync(artifacts[0]!.path, 'utf8'), 'controlled build artifact bytes');
  assert.equal(release.result!.simulation, true);
  assert.deepEqual(await f.execute('release', 'release.create'), release);
  assert.equal(f.store.resources().filter((resource) => resource.kind === 'release').length, 1);
});

test('simulated release rejects missing build artifacts', async (t) => {
  const f = new PullRequestFixture(t);
  await f.prepare();
  f.result = 'passed';
  await f.execute('check', 'pull-request.check');
  await f.merge();
  await assert.rejects(
    () => f.execute('release', 'release.create'),
    /actual captured build artifacts/,
  );
  assert.equal(
    f.store.resources().some((resource) => resource.kind === 'release'),
    false,
  );
});

registerSuite({
  component: 'operations',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'lifecycle-effects'],
});
