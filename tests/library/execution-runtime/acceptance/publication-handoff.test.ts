import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { RunPublication } from '../../../../dist/library/execution-runtime/run-publication.js';
import { Publisher } from '../../../../dist/library/publisher/publisher.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { PromotionFixture } from '../support/promotion-fixture.js';

/** Covers automatic publication after handing verified candidate state between actual run identities. */
class PublicationHandoffScenarios {
  /** An inherited task baseline neither creates a workday delivery nor blocks unrelated ready work. */
  inherited(t: TestContext): void {
    const { f, run, publication } = this.fixture(t);
    const ready = f.host.store.enqueue(run.id, 'b', 'Independent stewardship');
    assert.doesNotThrow(() => publication.capture(run));
    assert.equal(f.host.store.run(run.id).status, 'running');
    assert.equal(f.host.store.run(run.id).data.deliveryId, undefined);
    assert.deepEqual(
      f.host.store.ready(run.id).map((item) => item.id),
      [ready.id],
    );
    assert.deepEqual(
      f.deliveries.list().map((item) => item.id),
      [f.delivery.id],
    );
    assert.equal(f.deliveries.get(f.delivery.id).runId, f.source.id);
    publication.capture(f.host.store.run(f.source.id));
    assert.equal(f.host.store.run(f.source.id).data.deliveryId, f.delivery.id);
  }

  /** Duplicate pending requests retain one durable check intent; a later explicit request receives a fresh one. */
  retryIdentity(t: TestContext): void {
    const { f, publication } = this.fixture(t);
    publication.request(f.delivery.id);
    const first = f.host.store.run(f.source.id).data.publicationCheckAttempt;
    assert.equal(typeof first, 'string');
    publication.request(f.delivery.id);
    assert.equal(f.host.store.run(f.source.id).data.publicationCheckAttempt, first);
    f.host.store.updateRun(f.source.id, 'completed', { pendingPublication: null });
    publication.request(f.delivery.id);
    assert.notEqual(f.host.store.run(f.source.id).data.publicationCheckAttempt, first);
  }

  /** Mismatched environment, revision, record or authority cannot be silently treated as a handoff. */
  invalid(t: TestContext, field: string): void {
    const { f, run, publication } = this.fixture(t);
    if (field === 'environment') run.environment = { id: 'foreign', mode: 'simulation' };
    else if (field === 'record') run.data.candidateRecord = { ...f.record, id: 'foreign' };
    else if (field === 'completion') run.data.candidateRecord = { ...f.record, status: 'failed' };
    else run.data[field] = 'changed';
    assert.throws(() => publication.capture(run), /Inherited publication candidate/);
    assert.equal(f.deliveries.list().length, 1);
  }

  /** Explicit publication continues rejecting foreign engineering rather than relaxing candidate identity. */
  explicit(t: TestContext): void {
    const { f, run } = this.fixture(t);
    const publisher = new Publisher(f.general.fixture.state, f.deliveries);
    assert.throws(
      () =>
        publisher.capture(
          f.context.key,
          run,
          [f.host.store.assignment(f.assignment.id)],
          f.delivery.target,
        ),
      /Candidate identity or engineering completion mismatch/,
    );
  }

  /** Reuses recorded review inputs while candidate snapshots, run storage and publisher services stay real. */
  private fixture(t: TestContext) {
    const f = new PromotionFixture(t);
    const workday = f.host.store.createRun(
      'workday',
      f.context.owners,
      'Stewardship',
      f.source.environment,
    );
    const original = f.host.store.run(f.source.id);
    f.host.store.updateRun(workday.id, 'running', {
      packageId: original.data.packageId,
      executionIdentity: original.data.executionIdentity,
      authorityBase: original.data.authorityBase,
      candidateRevision: original.data.candidateRevision,
      candidateRecord: original.data.candidateRecord,
    });
    const publication = new RunPublication(f.general.fixture.state, f.context, f.host.store);
    return { f, run: f.host.store.run(workday.id), publication };
  }
}

const scenarios = new PublicationHandoffScenarios();

test('publication retries persist one check identity per pending explicit request', (t) =>
  scenarios.retryIdentity(t));

test('automatic publication preserves inherited candidate attribution and ready work', (t) =>
  scenarios.inherited(t));

for (const field of [
  'environment',
  'record',
  'completion',
  'candidateRevision',
  'executionIdentity',
])
  test(`automatic publication rejects changed handoff ${field}`, (t) =>
    scenarios.invalid(t, field));

test('explicit publisher still rejects foreign-run candidate identity', (t) =>
  scenarios.explicit(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
