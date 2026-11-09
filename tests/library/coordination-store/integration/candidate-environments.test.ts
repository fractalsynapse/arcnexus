import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';

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

  /** Delivers one verified assignment through the production candidate transaction. */
  deliver(revision: string, environment?: RunEnvironment) {
    const run = this.store.createRun('task', ['a', 'b', 'c'], 'Useful goal', environment);
    this.store.updateRun(run.id, 'running', { authorityBase: 'base', packageId: 'package' });
    const assignment = this.store.enqueue(run.id, 'a', 'Work');
    this.store.complete(assignment.id, ['Observed evidence'], { candidateRevision: revision });
    return run;
  }
}

test('candidate pointer never crosses live, simulation or separate simulation identities', (t) => {
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

registerSuite({
  component: 'coordination-store',
  level: 'integration',
  tags: ['deterministic', 'lifecycle-effects'],
});
