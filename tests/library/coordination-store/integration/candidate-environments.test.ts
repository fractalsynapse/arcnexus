import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import type { DeliveryRecord } from '../../../../dist/library/coordination-store/delivery-types.js';
import type { RunEnvironment } from '../../../../dist/library/coordination-store/execution-types.js';
import { ExecutionReports } from '../../../../dist/library/report/report.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises real candidate transactions across captured live and simulation environments. */
class CandidateFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'anx-candidate-environments-'));

  readonly store = new ExecutionStore(join(this.root, 'execution.sqlite'));

  /** Retains one database for the scenario and removes only its private files afterward. */
  constructor(t: TestContext) {
    t.after(() => {
      this.store.close();
      rmSync(this.root, { recursive: true, force: true });
    });
  }

  /** Supplies explicitly controlled proof metadata to exercise the atomic pointer transition. */
  promotion() {
    const environment: RunEnvironment = { id: 'live', mode: 'live' };
    const run = this.store.createRun('task', ['a'], 'Promote', environment);
    this.store.updateRun(run.id, 'running', {
      authorityBase: 'base',
      packageId: 'package',
      executionIdentity: 'authority',
      promotionSource: 'simulation-delivery',
      promotionStage: 'verifying',
    });
    const delivery = this.capture(run.id, environment);
    const proof = {
      record: { id: 'record', base: 'promoted', executionRunId: run.id, status: 'completed' },
      goalEvidence: ['goal'],
    };
    return { run, delivery, proof };
  }

  /** Defines immutable delivery provenance separately from its mutable live run checkpoint. */
  private capture(runId: string, environment: RunEnvironment): DeliveryRecord {
    return {
      id: 'promotion',
      projectId: 'project',
      packageId: 'package',
      runId,
      assignmentIds: ['original-simulation-assignment'],
      environment,
      authorityDigest: 'authority',
      base: 'base',
      candidate: 'promoted',
      candidateRecordId: 'record',
      verification: { references: ['target-checks', 'review', 'goal'], digest: 'controlled' },
      target: { repository: 'example/project', branch: 'staging' },
      promotedFrom: 'simulation-delivery',
      version: 1,
      createdAt: 'fixture',
      engineering: 'verified',
      delivery: 'retained',
      integration: 'not_requested',
      publication: 'not_requested',
      receipts: {},
    };
  }

  /** Delivers one verified assignment through the production candidate transaction. */
  deliver(revision: string, environment?: RunEnvironment) {
    const run = this.store.createRun('task', ['a', 'b', 'c'], 'Useful goal', environment);
    this.store.updateRun(run.id, 'running', { authorityBase: 'base', packageId: 'package' });
    const assignment = this.store.enqueue(run.id, 'a', 'Work');
    this.store.complete(assignment.id, ['Observed evidence'], { candidateRevision: revision });
    return run;
  }
}

test('candidate promotion never crosses live, simulation or separate simulation identities', (t) => {
  const f = new CandidateFixture(t);
  const environments: RunEnvironment[] = [
    { id: 'shared-name', mode: 'live' },
    { id: 'shared-name', mode: 'simulation' },
    { id: 'other-simulation', mode: 'simulation' },
  ];
  f.deliver('historical');
  for (const [index, environment] of environments.entries())
    f.deliver(`revision-${index}`, environment);
  assert.equal(f.store.latestDelivery('base', 'package')!.data.candidateRevision, 'historical');
  for (const [index, environment] of environments.entries())
    assert.equal(
      f.store.latestDelivery('base', 'package', environment)!.data.candidateRevision,
      `revision-${index}`,
    );
  assert.equal(
    f.store.latestDelivery('base', 'package', { id: 'unknown', mode: 'simulation' }),
    undefined,
  );
});

test('run environment survives lifecycle updates and cannot be replaced by candidate metadata', (t) => {
  const f = new CandidateFixture(t);
  const environment: RunEnvironment = { id: 'simulation', mode: 'simulation' };
  const run = f.deliver('candidate', environment);
  environment.id = 'changed-outside';
  f.store.updateRun(run.id, 'paused', { environment: { id: 'forged', mode: 'live' } });
  const retained = f.store.run(run.id);
  assert.deepEqual(retained.environment, { id: 'simulation', mode: 'simulation' });
  assert.equal(retained.status, 'paused');
  const report = new ExecutionReports(f.root, f.store).view(run.id);
  assert.deepEqual(report.run.environment, retained.environment);
});

test('promotion atomically retains goal proof and duplicate acceptance cannot rewind later work', (t) => {
  const f = new CandidateFixture(t);
  const { run, delivery, proof } = f.promotion();
  f.store.promotion(run.id, delivery, proof);
  assert.equal(f.store.latestDelivery('base', 'package', run.environment)!.id, run.id);
  assert.deepEqual(f.store.run(run.id).data.goalEvidence, ['goal']);
  assert.equal(f.store.run(run.id).data.pendingPublication, delivery.id);
  assert.deepEqual(f.store.assignments(run.id), []);
  const later = f.deliver('later', run.environment);
  f.store.promotion(run.id, delivery, proof);
  assert.equal(f.store.latestDelivery('base', 'package', run.environment)!.id, later.id);
});

test('promotion refuses mismatched target authority and missing goal proof without pointer mutation', (t) => {
  const f = new CandidateFixture(t);
  const { run, delivery, proof } = f.promotion();
  assert.throws(
    () => f.store.promotion(run.id, { ...delivery, authorityDigest: 'foreign' }, proof),
    /authority/,
  );
  assert.throws(
    () => f.store.promotion(run.id, delivery, { ...proof, goalEvidence: [] }),
    /goal evidence/,
  );
  assert.equal(f.store.latestDelivery('base', 'package', run.environment), undefined);
  assert.equal(f.store.run(run.id).data.promotionStage, 'verifying');
});

registerSuite({
  component: 'coordination-store',
  level: 'integration',
  tags: ['deterministic', 'lifecycle-effects'],
});
