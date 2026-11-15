import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { WorkdayStore } from '../../../../dist/library/coordination-store/workday-store.js';
import { workflowFixture } from '../../testing/support/workflow-fixture.js';

/** Exercises workday store behavior through observable scenarios. */
class WorkdayStoreTests {
  /** Verifies that delivery and readiness are atomic. */
  deliveryAndReadinessAreAtomic(t: TestContext): void {
    const fixture = workflowFixture(t);
    const directory = join(fixture.state, 'workdays', 'one');
    mkdirSync(directory, { recursive: true });
    const store = new WorkdayStore(join(directory, 'workday.sqlite'), true);
    try {
      store.initialize('one', { base: fixture.git('rev-parse', 'HEAD') }, ['sample', 'dependency']);
      this.deliver(store);
      this.assertDuplicateRollsBack(store);
      store.commit(
        'workday.finished',
        {},
        { workday: { id: 'one', status: 'completed', data: {} } },
      );
      this.assertRetainedOrder(store);
    } finally {
      store.close();
    }
  }

  /** Commits message delivery and dependent readiness through one durable store transition. */
  private deliver(store: WorkdayStore): void {
    store.commit(
      'request.delivered',
      { id: 'request-1' },
      {
        assignments: [{ id: 'dependency', status: 'ready', data: {} }],
        messages: [
          {
            id: 'request-1',
            from: 'sample',
            to: 'dependency',
            kind: 'request',
            payload: { contract: 'sample' },
          },
        ],
      },
    );
  }

  /** Requires duplicate delivery to roll back without additional scheduling or events. */
  private assertDuplicateRollsBack(store: WorkdayStore): void {
    assert.throws(() =>
      store.commit(
        'duplicate',
        {},
        {
          assignments: [{ id: 'dependency', status: 'incorrect', data: {} }],
          messages: [
            { id: 'request-1', from: 'sample', to: 'dependency', kind: 'request', payload: {} },
          ],
        },
      ),
    );
    assert.equal(
      store.snapshot().assignments.find((assignment) => assignment.id === 'dependency')?.status,
      'ready',
    );
    assert.equal(store.events().length, 2);
  }

  /**
   * Runs the built gateway against the persisted coordination state, then proves the retained order.
   *
   * `workday history` and `workday follow` are retired (cli-gateway SS4, GW-11) and their named
   * replacement, `evidence get`, is not implemented — see #450. The built reader deleted in that
   * change was the only surface over this store, so the ordered-evidence guarantee below is proven
   * against the durable store that the retired surface read, and the refusal itself is covered by
   * `tests/gateway/cli/acceptance/execution-migration.test.ts`, which owns that surface.
   */
  private assertRetainedOrder(store: WorkdayStore): void {
    assert.equal(store.snapshot().messages.length, 1);
    assert.deepEqual(
      store
        .events(1)
        .map((event) => event.sequence)
        .sort((a, b) => a - b),
      [2, 3],
    );
  }
}

const suite = new WorkdayStoreTests();

test('SQLite delivery and readiness commit atomically and retain ordered evidence', (t) =>
  suite.deliveryAndReadinessAreAtomic(t));

registerSuite({ component: 'coordination-store', level: 'integration', tags: ['deterministic'] });
