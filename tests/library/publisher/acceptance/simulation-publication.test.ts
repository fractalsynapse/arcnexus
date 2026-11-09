import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import {
  Publication,
  EvidencePublicationProvider,
  type EvidencePublicationContext,
} from '../../../../dist/library/publisher/publisher.js';
import type { CapturedPublicationPolicy } from '../../../../dist/library/publisher/publisher.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { GitDeliveryFixture } from '../../testing/support/delivery-fixture.js';

/** Exercises complete provider orchestration with actual Git and controlled check-boundary inputs. */
class PublicationFixture {
  readonly git: GitDeliveryFixture;

  readonly publication: Publication;

  checks = 0;

  readonly policy: CapturedPublicationPolicy = {
    owner: 'publisher',
    operation: {
      schemaVersion: 4,
      id: 'publish',
      kind: 'upstream',
      action: 'delivery.publish',
      purpose: 'Controlled publication authority',
      repository: 'repo',
      cwd: '.',
      category: 'collaboration',
      activities: ['release'],
      generatedDirectories: [],
      artifacts: [],
      probes: [],
      targetBranch: 'staging',
      definitionDigest: 'policy',
    },
  };

  result: 'passed' | 'failed' | 'interrupted' = 'passed';

  /** Uses production effect and publication wiring while keeping synthetic verification in acceptance. */
  constructor(t: TestContext) {
    this.git = new GitDeliveryFixture(t);
    writeFileSync(join(this.git.root, 'built-output'), 'controlled artifact');
    this.publication = this.instance(t);
  }

  /** Reopens provider orchestration with an explicit retained check intent and unchanged delivery authority. */
  instance(t: TestContext, checkAttempt?: string): Publication {
    const context: EvidencePublicationContext = {
      root: this.git.root,
      repositoryId: 'repo',
      repository: this.git.repository,
      effects: this.git.effects,
      deliveries: this.git.store,
      policy: this.policy,
      checkAttempt,
      checks: async () => this.check(),
    };
    const publication = new Publication(
      context,
      new EvidencePublicationProvider(context, this.git.store.get(this.git.id)),
      this.git.store.get(this.git.id),
    );
    t.after(() => publication.close());
    return publication;
  }

  /** Counts actual check-boundary calls and can model an observed failure or uncertain interruption. */
  private check() {
    this.checks++;
    if (this.result === 'interrupted') throw new Error('Controlled check interruption');
    return {
      status: this.result,
      evidence: ['controlled-check'],
      artifacts: [
        {
          path: join(this.git.root, 'built-output'),
          sha256: createHash('sha256').update('controlled artifact').digest('hex'),
        },
      ],
    };
  }
}

test('publication retains pending PR until revision approval then completes and reuses every receipt', async (t) => {
  const f = new PublicationFixture(t);
  await assert.rejects(() => f.publication.publish(f.git.signal), /requires approval/);
  const pending = f.git.store.get(f.git.id);
  assert.equal(pending.delivery, 'pushed');
  assert.equal(pending.integration, 'pending');
  assert.equal(f.git.provider.targetHead(), f.git.repository.base);
  f.git.store.approve(pending.id, pending.version, pending.candidate);
  const released = await f.instance(t, 'approval-only').publish(f.git.signal);
  assert.equal(released.integration, 'merged');
  assert.equal(released.publication, 'released');
  assert.equal(f.checks, 2);
  assert.deepEqual(await f.publication.publish(f.git.signal), released);
  assert.equal(f.checks, 2);
  assert.equal(f.git.effects.effects().length, 7);
});

test('explicit simulated check refresh retains failed evidence and all original mutation receipts', async (t) => {
  const f = new PublicationFixture(t);
  f.result = 'failed';
  await assert.rejects(() => f.publication.publish(f.git.signal), /checks failed/);
  const failed = structuredClone(
    f.git.effects.effects().find((e) => e.operation === 'pull-request.check'),
  )!;
  const pending = f.git.store.get(f.git.id);
  const receipts = structuredClone(pending.receipts);
  f.git.store.approve(pending.id, pending.version, pending.candidate);
  f.result = 'passed';
  const retry = f.instance(t, 'retained-retry');
  const released = await retry.publish(f.git.signal);
  assert.equal(released.publication, 'released');
  assert.equal(f.checks, 3);
  assert.deepEqual(
    f.git.effects.effects().find((e) => e.id === failed.id),
    failed,
  );
  for (const [key, value] of Object.entries(receipts))
    assert.equal(released.receipts[key as keyof typeof receipts], value);
  assert.deepEqual(await retry.publish(f.git.signal), released);
  assert.equal(f.checks, 3);
  assert.equal(f.git.effects.effects().length, 8);
});

test('explicit simulated check refresh cannot bypass an uncertain earlier check', async (t) => {
  const f = new PublicationFixture(t);
  f.result = 'interrupted';
  await assert.rejects(() => f.publication.publish(f.git.signal), /Controlled check interruption/);
  f.result = 'passed';
  const retry = f.instance(t, 'fresh-intent');
  await assert.rejects(() => retry.publish(f.git.signal), /uncertain|reconciliation|unknown/i);
  assert.equal(f.checks, 1);
  assert.equal(f.git.effects.effects().length, 4);
  assert.equal(f.git.store.get(f.git.id).integration, 'pending');
});

registerSuite({
  component: 'publisher',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'lifecycle-effects'],
});
