import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Reopens the real store to inspect what dispatch can recover from one direction decision. */
class DirectionAdmissionScenario {
  /** A late refusal rolls back earlier proposals, a diagnosed continuation and the run checkpoint. */
  exercise(t: TestContext): void {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-direction-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = join(root, 'execution.sqlite');
    const store = new ExecutionStore(path);
    const run = store.createRun('task', ['owner'], 'Deliver the change');
    const original = store.enqueue(run.id, 'owner', 'Existing work');
    store.fail(original.id, 'failed', 'Missing evidence');
    this.rejectBatch(store, run.id, original.id);
    store.close();
    const recovered = new ExecutionStore(path);
    t.after(() => recovered.close());
    this.verifyRecovery(recovered, run.id, original.id);
  }

  private readonly proposal = {
    owner: 'owner',
    objective: 'Follow up',
    acceptance: ['Observed'],
    data: { kind: 'research' },
  };

  /** Forces a refusal after both a continuation and a valid new assignment were processed. */
  private rejectBatch(store: ExecutionStore, id: string, original: string): void {
    const continuation = [{ assignmentId: original, ownerId: 'owner', reason: 'Evidence located' }];
    const events = store.events().length;
    assert.throws(
      () =>
        store.admitDirection(
          id,
          [this.proposal, { ...this.proposal, owner: 'unknown' }],
          continuation,
          { initialized: true },
        ),
      /Unknown eligible owner/,
    );
    assert.equal(store.events().length, events);
  }

  /** Observes the pre-decision state after reopening and then admits the corrected decision. */
  private verifyRecovery(recovered: ExecutionStore, id: string, original: string): void {
    const continuation = [{ assignmentId: original, ownerId: 'owner', reason: 'Evidence located' }];
    assert.equal(recovered.run(id).data.initialized, undefined);
    assert.deepEqual(
      recovered.assignments(id).map((a) => a.status),
      ['failed'],
    );
    recovered.admitDirection(id, [this.proposal], continuation, { initialized: true });
    assert.equal(recovered.run(id).data.initialized, true);
    assert.deepEqual(
      recovered.ready(id).map((a) => a.objective),
      ['Existing work', 'Follow up'],
    );
    assert.equal(recovered.ready(id)[1]!.data.kind, 'research');
  }
}

test('director admission persists a whole decision or rolls it back', (t) =>
  new DirectionAdmissionScenario().exercise(t));

registerSuite({
  component: 'coordination-store',
  level: 'integration',
  tags: ['deterministic', 'recovery'],
});
