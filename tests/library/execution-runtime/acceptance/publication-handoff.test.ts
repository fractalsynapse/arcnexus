import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test as deterministicTest, type TestContext } from 'node:test';
import {
  ExecutionContext,
  executionIdentity,
} from '../../../../dist/library/architecture/execution-context.js';
import { DeliveryStore } from '../../../../dist/library/coordination-store/delivery-store.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { RunEnvironments } from '../../../../dist/library/execution-runtime/run-environments.js';
import { RunPublication } from '../../../../dist/library/execution-runtime/run-publication.js';
import { CandidateSnapshots } from '../../../../dist/library/workspace/candidates.js';
import { Publisher } from '../../../../dist/library/publisher/publisher.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import {
  generalCatalogFixture,
  nativeHostTest as test,
} from '../../testing/support/general-fixture.js';
import { PublicationFixture } from '../support/publication-fixture.js';

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
    const f = new PublicationFixture(t);
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

/** Exercises retained causes through production host checkpoints with controlled failing collaborators. */
class RetainedFailureScenarios {
  /** A run preparation failure retains one formatted message in durable state and its saved report. */
  async run(t: TestContext, failure: unknown, message: string): Promise<void> {
    const f = generalCatalogFixture(t);
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.close());
    const run = host.submit('Retain the original diagnostic');
    t.mock.method(RunEnvironments.prototype, 'prepare', async () => {
      throw failure;
    });
    await host.tick();
    const retained = host.store.run(run.id);
    assert.equal(retained.status, 'needs_attention');
    assert.equal(
      retained.data.error,
      'Error: ' + message,
      'run retains exactly one formatted cause',
    );
    const reportPath = host.reports.view(run.id).report;
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert.equal(report.run.data.error, 'Error: ' + message);
    assert.equal(retained.data.publicationBlocker, undefined);
  }

  /** Integrity validation retains the original diagnostic through the host's existing failure path. */
  async integrity(t: TestContext): Promise<void> {
    const f = generalCatalogFixture(t);
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.close());
    const run = host.submit('Retain the original integrity diagnostic');
    const diagnostic = ' \tCandidate Error: mismatch\n  retained detail\t ';
    t.mock.method(CandidateSnapshots.prototype, 'capture', () => {
      throw new Error(diagnostic);
    });
    await host.tick();
    const retained = host.store.run(run.id);
    assert.equal(retained.status, 'needs_attention');
    assert.equal(retained.data.error, 'Error: ' + diagnostic);
    assert.equal(retained.data.integrityError, 'Error: ' + diagnostic);
  }

  /** Delivery storage failure uses the existing publication path without replacing engineering state. */
  async delivery(t: TestContext, failure: unknown, message: string): Promise<void> {
    const f = generalCatalogFixture(t);
    const context = new ExecutionContext().resolve(f.repo);
    const host = new ProjectHost(f.state, context);
    t.after(() => host.close());
    const run = host.store.createRun('task', context.owners, 'Retain delivery failure', {
      id: 'controlled-delivery-environment',
      mode: 'simulation',
    });
    host.store.updateRun(run.id, 'completed', {
      executionIdentity: executionIdentity(context),
      pendingPublication: 'retained-delivery-pointer',
    });
    t.mock.method(DeliveryStore.prototype, 'get', () => {
      throw failure;
    });
    await host.tick();
    const retained = host.store.run(run.id);
    assert.equal(
      retained.data.publicationBlocker,
      'Error: ' + message,
      'delivery retains exactly one formatted cause',
    );
    assert.equal(retained.status, 'completed');
    assert.equal(retained.data.pendingPublication, 'retained-delivery-pointer');
    assert.equal(retained.data.error, undefined);
  }
}

const retainedFailures = new RetainedFailureScenarios();

deterministicTest('integrity failure retains the original formatted diagnostic', (t) =>
  retainedFailures.integrity(t),
);

const plainDiagnostic = 'Cannot read retained evidence: resource unavailable.';

const spacedDiagnostic = ' \tRead failed; keep punctuation! Error: embedded\n  detail\t ';

const literalDiagnostic = 'Error: original diagnostic; Error: embedded\n\t  ';

const failureCases = [
  { name: 'Error object', failure: new Error(plainDiagnostic), message: plainDiagnostic },
  {
    name: 'typed Error object',
    failure: new TypeError(spacedDiagnostic),
    message: spacedDiagnostic,
  },
  { name: 'literal prefix', failure: new Error(literalDiagnostic), message: literalDiagnostic },
  { name: 'diagnostic string', failure: spacedDiagnostic, message: spacedDiagnostic },
  {
    name: 'nested cause',
    failure: new Error(plainDiagnostic, { cause: new Error('Nested cause must not be repeated') }),
    message: plainDiagnostic,
  },
];

for (const { name, failure, message } of failureCases) {
  deterministicTest('retained run failure preserves exactly one cause: ' + name, (t) =>
    retainedFailures.run(t, failure, message),
  );

  deterministicTest('retained delivery failure preserves exactly one cause: ' + name, (t) =>
    retainedFailures.delivery(t, failure, message),
  );
}

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
