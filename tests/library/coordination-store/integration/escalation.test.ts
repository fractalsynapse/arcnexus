import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import type { Escalation } from '../../../../dist/library/coordination-store/escalation-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises a blocked owner's wait as readable, replayable state rather than error text. */
class EscalationFixture {
  readonly path: string;

  readonly store: ExecutionStore;

  readonly runId: string;

  readonly assignmentId: string;

  /** Opens fresh storage per scenario and releases it before its directory is removed. */
  constructor(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-escalation-'));
    this.path = join(root, 'execution.sqlite');
    this.store = new ExecutionStore(this.path);
    t.after(() => {
      this.store.close();
      rmSync(root, { recursive: true, force: true });
    });
    this.runId = this.store.createRun(
      'task',
      ['architecture', 'direction'],
      'Simplify the lifecycle',
    ).id;
    this.assignmentId = this.store.enqueue(this.runId, 'architecture', 'Publish the contract', [
      'Interface states the outcome',
    ]).id;
  }

  /** Reopens the same storage to prove what a later activation or a human would read back. */
  reopen(t: TestContext): ExecutionStore {
    const store = new ExecutionStore(this.path);
    t.after(() => store.close());
    return store;
  }

  /** Builds the wait an owner raises when it cannot close its own acceptance. */
  wait(overrides: Partial<Escalation> = {}): Escalation {
    return this.store.escalations.open({
      runId: this.runId,
      assignmentId: this.assignmentId,
      owner: 'architecture',
      goal: { objective: 'Publish the contract', acceptance: ['Interface states the outcome'] },
      planRevision: 3,
      openSteps: [{ id: 'step-1', activity: 'review', status: 'pending' }],
      evidence: ['evidence:checkpoint-1'],
      reason: 'Awaiting the direction owner to accept the amended interface',
      ...overrides,
    });
  }
}

const scenarios = {
  /** CO-20: stored with reason, goal identity, plan revision, open steps and evidence references. */
  stored(t: TestContext): void {
    const f = new EscalationFixture(t);
    f.wait();
    const waits = f.reopen(t).escalations.outstanding(f.runId);
    assert.equal(waits.length, 1);
    const wait = waits[0]!;
    assert.equal(wait.reason, 'Awaiting the direction owner to accept the amended interface');
    assert.deepEqual(wait.goal, {
      objective: 'Publish the contract',
      acceptance: ['Interface states the outcome'],
    });
    assert.equal(wait.planRevision, 3);
    assert.deepEqual(wait.openSteps, [{ id: 'step-1', activity: 'review', status: 'pending' }]);
    assert.deepEqual(wait.evidence, ['evidence:checkpoint-1']);
    assert.equal(wait.owner, 'architecture');
    assert.equal(wait.assignmentId, f.assignmentId);
  },

  /** CO-20: a repeated activation of one blocker does not stack duplicate waits. */
  deduplicated(t: TestContext): void {
    const f = new EscalationFixture(t);
    const first = f.wait();
    const second = f.wait({ planRevision: 9 });
    assert.equal(second.id, first.id);
    assert.equal(f.store.escalations.outstanding(f.runId).length, 1);
  },

  /** CO-20: resolving closes the entity and leaves the recorded goal and acceptance untouched. */
  resolved(t: TestContext): void {
    const f = new EscalationFixture(t);
    const wait = f.wait({ reason: 'Awaiting review' });
    const closed = f.store.escalations.close(wait.id, 'the direction owner accepted the interface');
    assert.equal(f.store.escalations.outstanding(f.runId).length, 0);
    assert.ok(closed.closedAt);
    assert.deepEqual(closed.goal, wait.goal);
    const replayed = f.store.escalations.close(wait.id, 'replayed effect');
    assert.equal(replayed.closedAt, closed.closedAt);
    assert.equal(replayed.resolution, 'the direction owner accepted the interface');
  },

  /** Verified delivery ends the wait it blocked, without rewriting the assignment's acceptance. */
  closedByDelivery(t: TestContext): void {
    const f = new EscalationFixture(t);
    const acceptance = [...f.store.assignment(f.assignmentId).acceptance];
    f.wait({ reason: 'Awaiting review' });
    f.store.complete(f.assignmentId, ['evidence:verified']);
    assert.equal(f.store.escalations.outstanding(f.runId).length, 0);
    assert.deepEqual(f.store.assignment(f.assignmentId).acceptance, acceptance);
  },

  /** CO-20: a wait reads as one owner waiting on another, oldest first. */
  ordered(t: TestContext): void {
    const f = new EscalationFixture(t);
    const other = f.store.enqueue(f.runId, 'direction', 'Answer the boundary question');
    f.wait({ reason: 'first wait' });
    f.wait({ assignmentId: other.id, reason: 'second wait' });
    assert.deepEqual(
      f.store.escalations.outstanding(f.runId).map((item) => item.reason),
      ['first wait', 'second wait'],
    );
  },
};

test('escalation is stored with its reason, goal identity, plan revision and open steps', (t) =>
  scenarios.stored(t));

test('a repeated blocker does not stack duplicate escalations', (t) => scenarios.deduplicated(t));

test('resolving an escalation closes it without rewriting the goal or its acceptance', (t) =>
  scenarios.resolved(t));

test('verified delivery closes the wait it was blocking', (t) => scenarios.closedByDelivery(t));

test('outstanding escalations read in the order they formed', (t) => scenarios.ordered(t));

registerSuite({ component: 'coordination-store', level: 'integration', tags: ['deterministic'] });
