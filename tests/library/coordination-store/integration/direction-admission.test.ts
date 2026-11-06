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

  /** Ready feedback retains current receipts, rejects running work, and cannot replace its workflow. */
  ready(t: TestContext): void {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-ready-direction-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const store = new ExecutionStore(join(root, 'execution.sqlite'));
    t.after(() => store.close());
    const run = store.createRun('task', ['owner'], 'Deliver the change');
    const assignment = store.enqueue(run.id, 'owner', 'Existing work', ['Original acceptance']);
    store.updateAssignment(assignment.id, 'ready', {
      lastReceipt: 'current',
      lastFailedOutcome: { receipt: 'old' },
    });
    const continuation = {
      assignmentId: assignment.id,
      ownerId: 'owner',
      reason: 'Caller finding',
    };
    store.admitDirection(run.id, [], [continuation], { initialized: true });
    const retained = store.assignment(assignment.id);
    assert.equal(retained.data.lastReceipt, 'current');
    assert.equal(retained.data.continuationReason, 'Caller finding');
    assert.deepEqual(retained.acceptance, assignment.acceptance);
    assert.equal(store.assignments(run.id).length, 1);
    this.rejectReadyMutation(store, run.id, continuation);
  }

  /** Feedback does not authorize a fresh workflow or modification during active execution. */
  private rejectReadyMutation(
    store: ExecutionStore,
    runId: string,
    continuation: { assignmentId: string; ownerId: string; reason: string },
  ): void {
    const replacement = { ...continuation, replacementChangeType: 'refactor' as const };
    assert.throws(() => store.admitDirection(runId, [], [replacement], {}), /Replacement requires/);
    store.updateAssignment(continuation.assignmentId, 'running');
    assert.throws(() => store.admitDirection(runId, [], [continuation], {}), /Invalid retained/);
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

test('ready direction preserves receipts without replacing or duplicating work', (t) =>
  new DirectionAdmissionScenario().ready(t));

registerSuite({
  component: 'coordination-store',
  level: 'integration',
  tags: ['deterministic', 'recovery'],
});

/** Exercises dependency retirement through the durable public execution store. */
class DirectionRetirementScenario {
  /** Retires one request, reopens the database, and verifies a stable replay. */
  sharedAndReplay(t: TestContext): void {
    const state = this.open(t);
    const otherId = this.connectShared(state);
    state.store.fail(state.source.id, 'failed', 'Direction changed');
    const transition = this.transition(state.source.id, state.requestId);
    this.admit(state, transition);
    const count = state.store.assignments(state.run.id).length;

    this.verifyRetired(state, otherId);
    this.verifyReplay(state, transition, count);
  }

  /** Keeps an independent explicit link blocking the requester after request retirement. */
  preservesExplicitLink(t: TestContext): void {
    const state = this.open(t);
    state.store.link(state.source.id, state.supplier.id);
    state.store.fail(state.source.id, 'failed', 'Direction changed');
    this.admit(state, this.transition(state.source.id, state.requestId));

    assert.deepEqual(state.store.assignment(state.source.id).dependencies, [state.supplier.id]);
    assert.equal(state.store.assignment(state.source.id).status, 'waiting');
    state.store.complete(state.supplier.id, ['Verified supplier delivery']);
    assert.equal(state.store.assignment(state.source.id).status, 'ready');
  }

  /** Retains the same supplier through a distinct active request and assignment. */
  private connectShared(state: ReturnType<DirectionRetirementScenario['open']>): string {
    const other = state.store.enqueue(state.run.id, 'other', 'Independent work');
    state.store.request(other.id, {
      ...state.request,
      key: 'shared-obligation',
      existingAssignmentId: state.supplier.id,
    });
    return other.id;
  }

  /** Checks the retired edge is hidden while shared work and assignment evidence remain intact. */
  private verifyRetired(
    state: ReturnType<DirectionRetirementScenario['open']>,
    otherId: string,
  ): void {
    const resumed = state.store.assignment(state.source.id);
    assert.equal(resumed.data.validatedCheckpoint, 'original');
    assert.deepEqual(resumed.dependencies, []);
    assert.equal(resumed.status, 'ready');
    assert.deepEqual(state.store.assignment(otherId).dependencies, [state.supplier.id]);
    assert.equal(state.store.assignment(state.supplier.id).status, 'ready');
    assert.equal(
      state.store.inbox(state.source.id).some((item) => item.id === state.requestId),
      false,
    );
  }

  /** Reopens SQLite and proves a repeated transition neither rewinds nor duplicates state. */
  private verifyReplay(
    state: ReturnType<DirectionRetirementScenario['open']>,
    transition: ReturnType<DirectionRetirementScenario['transition']>,
    count: number,
  ): void {
    state.store.close();
    state.store = new ExecutionStore(state.path);
    assert.equal(state.store.assignment(state.source.id).data.validatedCheckpoint, 'original');
    state.store.updateRun(state.run.id, 'running', { directionCheckpoint: 'later' });
    this.admit(state, transition);
    assert.equal(state.store.assignments(state.run.id).length, count);
    assert.equal(state.store.run(state.run.id).data.directionCheckpoint, 'later');
    assert.throws(() => state.store.request(state.source.id, state.request), /cannot be recreated/);
  }

  /** Refuses in-flight supplier work without changing the request, dependency, or new proposals. */
  refusesInFlight(t: TestContext): void {
    const state = this.open(t);
    state.store.updateAssignment(state.supplier.id, 'running');
    state.store.fail(state.source.id, 'failed', 'Direction changed');
    const assignments = state.store.assignments(state.run.id);

    assert.throws(
      () => this.admit(state, this.transition(state.source.id, state.requestId)),
      /in-flight dependency request/,
    );
    assert.deepEqual(state.store.assignments(state.run.id), assignments);
    assert.deepEqual(state.store.assignment(state.source.id).dependencies, [state.supplier.id]);
    assert.equal(
      state.store.inbox(state.source.id).some((item) => item.id === state.requestId),
      true,
    );
  }

  /** Rejects a request ID whose current relationship belongs to another assignment. */
  refusesUnrelatedRelationship(t: TestContext): void {
    const state = this.open(t);
    const foreign = state.store.enqueue(state.run.id, 'other', 'Foreign request');
    const foreignSupplier = state.store.request(foreign.id, {
      ...state.request,
      key: 'foreign',
    });
    const foreignRequestId = state.store.inbox(foreign.id)[0]!.id;
    state.store.fail(state.source.id, 'failed', 'Direction changed');
    const assignments = state.store.assignments(state.run.id);

    assert.throws(
      () =>
        this.admit(state, {
          ...this.transition(state.source.id, state.requestId),
          retirements: [{ assignmentId: state.source.id, requestId: foreignRequestId }],
        }),
      /Invalid or stale request retirement relationship/,
    );
    assert.deepEqual(state.store.assignments(state.run.id), assignments);
    assert.equal(state.store.assignment(foreignSupplier.id).status, 'ready');
  }

  /** Opens one source request with a durable validated checkpoint for the scenarios. */
  private open(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-retirement-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = join(root, 'execution.sqlite');
    const store = new ExecutionStore(path);
    const run = store.createRun('task', ['owner', 'supplier', 'other'], 'Deliver the change');
    const source = store.enqueue(run.id, 'owner', 'Original assignment');
    store.updateAssignment(source.id, 'ready', { validatedCheckpoint: 'original' });
    const request = {
      key: 'obsolete',
      owner: 'supplier',
      objective: 'Supplier work',
      acceptance: ['Deliver proof'],
    };
    const supplier = store.request(source.id, request);
    const requestId = store.inbox(source.id)[0]!.id;
    const state = { store, path, run, source, request, supplier, requestId };
    t.after(() => state.store.close());
    return state;
  }

  /** Submits retirement through the same admission method used for initial direction. */
  private admit(
    state: ReturnType<DirectionRetirementScenario['open']>,
    transition: ReturnType<DirectionRetirementScenario['transition']>,
  ): void {
    state.store.admitDirection(
      state.run.id,
      transition.proposals,
      transition.continuations,
      transition.checkpoint,
      transition,
    );
  }

  /** Builds the validated transition for reopening the same assignment checkpoint. */
  private transition(assignmentId: string, requestId: string) {
    return {
      id: 'retire-obsolete-direction',
      proposals: [
        {
          owner: 'owner',
          objective: 'New direction work',
          acceptance: ['Complete the revised objective'],
          data: {},
        },
      ],
      continuations: [
        { assignmentId, ownerId: 'owner', reason: 'The previous dependency is obsolete' },
      ],
      checkpoint: { directionCheckpoint: 'validated' },
      retirements: [{ assignmentId, requestId }],
    };
  }
}

const retirement = new DirectionRetirementScenario();

test('ordinary direction admission retires obsolete requests and preserves the validated checkpoint', (t) =>
  retirement.sharedAndReplay(t));

test('direction admission preserves an independent explicit dependency', (t) =>
  retirement.preservesExplicitLink(t));

test('direction admission refuses in-flight dependency retirement atomically', (t) =>
  retirement.refusesInFlight(t));

test('direction admission refuses unrelated request retirement atomically', (t) =>
  retirement.refusesUnrelatedRelationship(t));
