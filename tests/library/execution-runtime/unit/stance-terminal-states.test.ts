import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import {
  recordInPlaceCompletion,
  recordPlanOutcome,
} from '../../../../dist/library/execution-runtime/plan-stance.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/**
 * Pins the terminal states the sealed stances must reach.
 *
 * An in-place run writes the operator's checkout and has nothing to integrate, so it must stop
 * rather than complete, and the goal-delivery route must never be entered. A plan run stops after
 * direction. Both rules are stated in the rulings and were previously evidenced only by live
 * demonstrations, which cost an activation each and cannot run in a deterministic profile.
 */
class StanceTerminalScenarios {
  /** Opens a throwaway store, discarding it when the scenario finishes. */
  private async withStore(run: (store: ExecutionStore) => void): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), 'arcnexus-stance-'));
    const store = new ExecutionStore(join(directory, 'execution.sqlite'));
    try {
      run(store);
    } finally {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }

  /** Creates a running task, optionally carrying a stance and in-place counters. */
  private open(store: ExecutionStore, data: Record<string, unknown> = {}) {
    const run = store.createRun('task', ['sample'], 'Improve the owned behavior');
    store.updateRun(run.id, 'running', data);
    return store.run(run.id);
  }

  /** A plan stance records direction and stops without claiming any delivery. */
  planStops(): Promise<void> {
    return this.withStore((store) => {
      const run = this.open(store);
      recordPlanOutcome(store, run, {
        summary: 'Two milestones, documentation first',
        owners: ['cli'],
        questions: ['Which activity narrows the fan-out?'],
      });
      const stored = store.run(run.id);
      assert.equal(stored.status, 'stopped');
      assert.equal(stored.data.planOnly, true);
      assert.equal(stored.data.planSummary, 'Two milestones, documentation first');
      assert.deepEqual(stored.data.planOwners, ['cli']);
    });
  }

  /** An in-place run that admitted nothing stops and says so instead of completing. */
  nothingAdmitted(): Promise<void> {
    return this.withStore((store) => {
      const run = this.open(store, { stance: { kind: 'component', component: 'sample' } });
      assert.equal(recordInPlaceCompletion(store, run), true);
      const stored = store.run(run.id);
      assert.equal(stored.status, 'stopped');
      assert.equal(stored.data.inPlaceOutcome, 'nothing admitted');
    });
  }

  /** Admitted work that nothing prepared still stops, naming the count it actually reached. */
  admittedButUnprepared(): Promise<void> {
    return this.withStore((store) => {
      const run = this.open(store, {
        stance: { kind: 'component', component: 'sample' },
        inPlaceAdmitted: 2,
      });
      assert.equal(recordInPlaceCompletion(store, run), true);
      const stored = store.run(run.id);
      const outcome = String(stored.data.inPlaceOutcome);
      assert.equal(stored.status, 'stopped');
      assert.equal(stored.data.inPlaceComplete, true);
      assert.match(outcome, /in place: 2 assignment\(s\) planned/);
      assert.doesNotMatch(outcome, /prepared/, 'no assignment was prepared here');
      assert.match(outcome, /nothing was assembled, committed or published/);
    });
  }

  /** A run without the component stance keeps its delivery route available to the caller. */
  ordinaryRunKeepsDelivery(): Promise<void> {
    return this.withStore((store) => {
      const run = this.open(store, { inPlaceAdmitted: 1 });
      assert.equal(recordInPlaceCompletion(store, run), false);
      const stored = store.run(run.id);
      assert.equal(stored.status, 'running');
      assert.equal(stored.data.inPlaceComplete, undefined);
    });
  }
}

const scenarios = new StanceTerminalScenarios();

test('a plan stance stops after direction without claiming delivery', () => scenarios.planStops());

test('an in-place component stance with nothing admitted stops honestly', () =>
  scenarios.nothingAdmitted());

test('an in-place stance names the count it reached and never claims publication', () =>
  scenarios.admittedButUnprepared());

test('a run without the sealed component stance keeps its delivery route', () =>
  scenarios.ordinaryRunKeepsDelivery());

registerSuite({ component: 'execution-runtime', level: 'unit', tags: ['deterministic'] });
