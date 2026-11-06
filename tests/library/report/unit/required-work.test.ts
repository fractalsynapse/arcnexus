import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { ExecutionReports } from '../../../../dist/library/report/execution-report.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Keeps archived dependency work visible without presenting it as runnable or verified. */
class RequiredWorkReportScenario {
  /** Projects the same required-work decision used by scheduling and goal completion. */
  run(t: TestContext): void {
    const { root, store, run, source, supplier, request } = this.fixture(t);
    store.admitDirection(
      run.id,
      [],
      [{ assignmentId: source.id, ownerId: 'a', reason: 'Obsolete' }],
      {},
      {
        id: 'decision',
        retirements: [{ assignmentId: source.id, requestId: request.id, rationale: 'Obsolete' }],
      },
    );
    const view = new ExecutionReports(root, store).view(run.id);
    assert.equal(view.assignments.length, 2);
    assert.equal(view.assignments.find((a) => a.id === supplier.id)?.required, false);
    assert.equal(view.assignments.find((a) => a.id === supplier.id)?.status, 'ready');
    assert.deepEqual(view.counts, { ready: 1, waiting: 0, verified: 0 });
  }

  /** Captures a real persisted request before its explicit direction retirement. */
  private fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-required-report-'));
    const store = new ExecutionStore(join(root, 'execution.sqlite'));
    t.after(() => {
      store.close();
      rmSync(root, { recursive: true, force: true });
    });
    const run = store.createRun('task', ['a', 'b'], 'Original goal');
    const source = store.enqueue(run.id, 'a', 'Original assignment');
    const supplier = store.request(source.id, {
      key: 'obsolete',
      owner: 'b',
      objective: 'Obsolete request',
      acceptance: ['Original evidence'],
    });
    const request = store.inbox(source.id)[0]!;
    return { root, store, run, source, supplier, request };
  }
}

const scenario = new RequiredWorkReportScenario();

test('execution reports retain disconnected work without advertising dispatch or delivery', (t) =>
  scenario.run(t));

registerSuite({ component: 'report', level: 'unit', tags: ['deterministic', 'recovery'] });
