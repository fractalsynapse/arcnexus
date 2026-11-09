import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext } from 'node:test';
import { EvidenceChangeRecord } from '../../../../dist/library/operations/evidence-change-record.js';
import { EvidenceRelease } from '../../../../dist/library/operations/evidence-release.js';
import { UpstreamExecution } from '../../../../dist/library/operations/upstream-execution.js';
import type { ExternalEffect } from '../../../../dist/library/coordination-store/lifecycle-types.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { GitDeliveryFixture } from '../../testing/support/delivery-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/**
 * Combines actual Git delivery with controlled check outcomes at the host-check boundary.
 *
 * There is no provider store to seed: every assertion reads the durable effect journal or the
 * record derived from it, which is exactly what the runtime sees.
 */
class ChangeFixture {
  readonly git: GitDeliveryFixture;

  readonly change: EvidenceChangeRecord;

  readonly release: EvidenceRelease;

  readonly executor: UpstreamExecution;

  result: 'passed' | 'failed' | 'interrupted' = 'failed';

  checks = 0;

  gates: Array<{ head: string; independent: boolean }> = [];

  artifacts: Array<{ path: string; sha256: string }> = [];

  reviewerCoverage = true;

  /** Opens the record and release over one actual commit/push delivery. */
  constructor(private readonly t: TestContext) {
    this.git = new GitDeliveryFixture(t);
    const delivery = this.git.store.get(this.git.id);
    this.change = new EvidenceChangeRecord(
      delivery,
      this.git.provider,
      this.git.effects,
      (head, signal, independent) => this.check(head, signal, independent),
    );
    this.release = new EvidenceRelease(
      delivery,
      this.change,
      this.git.effects,
      join(this.git.root, 'artifacts'),
    );
    this.executor = this.buildExecutor();
  }

  /** Binds the record and release to the durable effect protocol the runtime uses. */
  private buildExecutor(): UpstreamExecution {
    return new UpstreamExecution(
      this.git.effects,
      {
        id: 'provider',
        mode: 'simulation',
        apply: async (effect, signal) =>
          effect.operation === 'release.create'
            ? this.release.apply(effect, signal)
            : this.change.apply(effect, signal),
        inspect: async (effect) =>
          effect.operation === 'release.create'
            ? this.release.inspect(effect)
            : this.change.inspect(effect),
      },
      {
        environmentId: 'sim',
        runId: 'run',
        authorityDigest: 'authority',
        grants: [
          'pull-request.create',
          'pull-request.check',
          'pull-request.merge',
          'release.create',
        ].map((operation) => ({ operation, target: 'repo', definitionDigest: 'policy' })),
      },
    );
  }

  /** Returns controlled check outcomes and counts attempts at the declared host-check boundary. */
  private async check(head: string, signal: AbortSignal, independent = false) {
    signal.throwIfAborted();
    this.checks++;
    this.gates.push({ head, independent });
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

  /** Delivers a real commit and push, then opens the change against that head. */
  async prepare(): Promise<void> {
    await this.git.execute('delivery.commit');
    await this.git.execute('delivery.push');
    await this.run('create', 'pull-request.create');
  }

  /** Supplies host-scoped intent, including the captured publication document for an opening. */
  run(id: string, operation: string, input: Record<string, unknown> = {}) {
    return this.executor.execute(
      id,
      operation,
      'repo',
      {
        deliveryId: this.git.id,
        ...(operation === 'pull-request.create'
          ? this.git.store.get(this.git.id).publicationDocument
          : {}),
        ...input,
      },
      this.git.signal,
    );
  }

  /** Captures the observed target once, so a retry reuses the same intent after the target moves. */
  merge() {
    const prior = this.git.effects.effects().find((effect) => effect.id === 'merge');
    return this.executor.execute(
      'merge',
      'pull-request.merge',
      'repo',
      prior?.input ?? { deliveryId: this.git.id, targetHead: this.git.provider.targetHead() },
      this.git.signal,
    );
  }

  /** Writes a real build output so release capture has bytes to verify and retain. */
  artifact(name: string, content: string) {
    const path = join(this.git.root, name);
    writeFileSync(path, content);
    const artifact = { path, sha256: createHash('sha256').update(content).digest('hex') };
    this.artifacts = [...this.artifacts, artifact];
    return artifact;
  }

  /** A release effect of the shape the engine would prepare for this delivery. */
  releaseEffect(id: string): ExternalEffect {
    return {
      id,
      environmentId: 'sim',
      runId: 'run',
      operation: 'release.create',
      target: 'repo',
      definitionDigest: 'policy',
      input: { deliveryId: this.git.id },
      inputDigest: 'input',
      status: 'prepared',
      attempt: 1,
    } as unknown as ExternalEffect;
  }

  /** The recorded effect for one operation, as the runtime would read it back. */
  effect(id: string): ExternalEffect {
    return this.git.effects.effect(id);
  }
}

test('a change opens only against the head that was actually pushed', async (t) => {
  const f = new ChangeFixture(t);
  await f.git.execute('delivery.commit');
  await f.git.execute('delivery.push');
  const opened = await f.run('create', 'pull-request.create');
  assert.equal(
    opened.result!.head,
    f.git.provider.targetHead(),
    'the change carries the pushed head',
  );
  assert.equal(f.change.state().state, 'open');
  assert.equal(f.change.state().checks, 'pending', 'nothing is claimed before a gate runs');
});

test('a merge requires passing checks bound to the current head with reviewer coverage', async (t) => {
  const f = new ChangeFixture(t);
  await f.prepare();
  f.result = 'passed';
  const checked = await f.run('check', 'pull-request.check');
  assert.equal(checked.result!.checks, 'passed');
  assert.deepEqual(checked.result!.reviewerEvidence, ['Independent reviewer coverage']);
  assert.equal(f.change.state().checkHead, f.change.state().head);
  assert.equal(f.change.assertReady().checks, 'passed');
});

test('passing checks without reviewer coverage cannot satisfy the merge gate', async (t) => {
  const f = new ChangeFixture(t);
  await f.prepare();
  f.result = 'passed';
  f.reviewerCoverage = false;
  await f.run('check', 'pull-request.check');
  assert.equal(f.change.state().checks, 'passed', 'the gate did pass on its own terms');
  assert.throws(() => f.change.assertReady(), /reviewer coverage/);
});

test('the assembled tree is verified independently before the target moves', async (t) => {
  const f = new ChangeFixture(t);
  await f.prepare();
  f.result = 'passed';
  await f.run('check', 'pull-request.check');
  const before = f.git.provider.targetHead();
  const merged = await f.merge();
  assert.equal(merged.result!.merged, true);
  assert.equal(f.git.provider.targetHead(), merged.result!.head, 'the actual ref moved');
  assert.notEqual(f.git.provider.targetHead(), before, 'integration was not a label');
  assert.equal(f.gates.length, 2, 'branch head then the assembled tree, never a reuse');
  assert.equal(f.gates.at(-1)!.independent, true, 'the assembled check is an independent gate');
  assert.equal(f.change.state().merged, true);
  assert.ok((merged.result!.verification as { evidence: string[] }).evidence.length);
  const reconciled = f.change.inspect(f.effect('merge'));
  assert.equal(
    reconciled.status,
    'completed',
    'a merge that moved the ref reconciles from the ref itself, not a stored claim',
  );
});

test('a failed assembled check leaves the target unchanged and reports an unmerged outcome', async (t) => {
  const f = new ChangeFixture(t);
  await f.prepare();
  f.result = 'passed';
  await f.run('check', 'pull-request.check');
  const before = f.git.provider.targetHead();
  f.result = 'failed';
  const outcome = await f.merge();
  assert.equal(outcome.result!.merged, false);
  assert.match(String(outcome.result!.reason), /Assembled merge failed/);
  assert.equal(f.git.provider.targetHead(), before, 'a refused merge moves nothing');
  assert.equal(f.change.state().merged, undefined, 'no merge identity is recorded');
});

test('an interrupted local gate is absent while the merge asks the actual ref', async (t) => {
  const f = new ChangeFixture(t);
  await f.prepare();
  f.result = 'interrupted';
  await assert.rejects(() => f.run('check', 'pull-request.check'), /Controlled check interruption/);
  const check = { ...f.effect('check'), operation: 'pull-request.check' };
  assert.equal(
    f.change.inspect(check).status,
    'absent',
    'a local computation with no external effect cannot have half-happened',
  );
  assert.equal(f.change.state().checks, 'pending', 'no partial gate result is claimed');
  await f.run('check', 'pull-request.check').catch(() => undefined);
  f.result = 'passed';
  await f.run('check', 'pull-request.check');
  assert.equal(f.change.state().checks, 'passed', 'retrying an absent local gate is not a replay');
});

test('release retains the merged verification artifacts and repeats idempotently', async (t) => {
  const f = new ChangeFixture(t);
  await f.prepare();
  const built = f.artifact('built-output', 'controlled artifact bytes');
  f.result = 'passed';
  await f.run('check', 'pull-request.check');
  await f.merge();
  const first = await f.release.apply(f.releaseEffect('release-1'), f.git.signal);
  const second = await f.release.apply(f.releaseEffect('release-1'), f.git.signal);
  assert.deepEqual(second, first);
  assert.equal(first.head, f.git.provider.targetHead(), 'released over the merged head');
  const retained = join(join(f.git.root, 'artifacts'), built.sha256);
  assert.ok(existsSync(retained));
  assert.equal(readFileSync(retained, 'utf8'), 'controlled artifact bytes');
});

test('release refuses a merged delivery whose gate produced no build artifacts', async (t) => {
  const f = new ChangeFixture(t);
  await f.prepare();
  f.result = 'passed';
  await f.run('check', 'pull-request.check');
  await f.merge();
  await assert.rejects(
    () => f.release.apply(f.releaseEffect('release-2'), f.git.signal),
    /merged verification and actual captured build artifacts/,
  );
});

registerSuite({
  component: 'operations',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'lifecycle-effects'],
});
