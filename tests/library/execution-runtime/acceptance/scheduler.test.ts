import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { Scheduler } from '../../../../dist/library/execution-runtime/scheduler.js';

/** Exercises the built scheduler using deterministic engineering outcomes. */
class SchedulerScenarios {
  /** Replays a journaled prepared outcome without invoking engineering or declaring delivery. */
  async prepared(t: TestContext): Promise<void> {
    const store = new ExecutionStore(this.database(t));
    t.after(() => store.close());
    const run = store.createRun('task', ['owner'], 'Retain contribution');
    const assignment = store.enqueue(run.id, 'owner', 'Related engineering');
    const contribution = {
      recordId: randomUUID(),
      base: 'a'.repeat(40),
      revision: 'b'.repeat(40),
      checkpoint: 'c'.repeat(64),
    };
    store.updateAssignment(assignment.id, 'ready', {
      recordId: contribution.recordId,
      pendingOutcome: { kind: 'prepared', contribution, receipt: contribution.checkpoint },
    });
    await new Scheduler(store, async () => {
      throw new Error('A journaled contribution must not replay engineering');
    }).step(run.id);
    const retained = store.assignment(assignment.id);
    assert.equal(retained.status, 'prepared');
    assert.deepEqual(retained.data.contribution, contribution);
    assert.equal(retained.data.pendingOutcome, null);
    assert.equal(retained.data.lastReceipt, contribution.checkpoint);
    assert.deepEqual(retained.evidence, []);
    assert.equal(store.run(run.id).data.candidateRevision, undefined);
  }

  /** A newer committed blocker retires stale routing failure state across reopen and continuation. */
  async currentReceipt(t: TestContext): Promise<void> {
    const path = this.database(t);
    let store = new ExecutionStore(path);
    const run = store.createRun('task', ['owner'], 'Recover current checkpoint');
    const assignment = store.enqueue(run.id, 'owner', 'Retained engineering');
    await new Scheduler(store, async () => ({
      kind: 'request',
      requests: [],
      receipt: 'rejected-routing',
    })).step(run.id);
    assert.equal(store.assignment(assignment.id).status, 'failed');
    const diagnosis = [
      { assignmentId: assignment.id, ownerId: 'owner', reason: 'Correct routing' },
    ];
    store.admitDirection(run.id, [], diagnosis, {});
    assert.equal(store.assignment(assignment.id).data.lastReceipt, 'rejected-routing');
    await new Scheduler(store, async () => ({
      kind: 'blocked',
      reason: 'Transport needs repair',
      receipt: 'current-checkpoint',
    })).step(run.id);
    store.close();
    store = new ExecutionStore(path);
    t.after(() => store.close());
    store.admitDirection(run.id, [], diagnosis, {});
    assert.equal(store.assignment(assignment.id).data.lastReceipt, 'current-checkpoint');
    assert.equal(store.assignment(assignment.id).data.lastFailedOutcome, null);
    assert.ok(JSON.stringify(store.events()).includes('Yield requires at least one request'));
  }

  /** Reopens durable state between activations while nested owners deliver in reverse order. */
  async nested(t: TestContext, count: number): Promise<void> {
    const path = this.database(t);
    let store = new ExecutionStore(path);
    const owners = Array.from({ length: count }, (_, i) => `owner-${i}`);
    const run = store.createRun('task', owners, 'Deliver the chain');
    store.enqueue(run.id, owners[0]!, 'Root objective');
    const visits: string[] = [];
    while (store.ready(run.id).length) {
      const scheduler = this.scheduler(store, owners, visits);
      await scheduler.step(run.id);
      store.close();
      store = new ExecutionStore(path);
    }
    assert.equal(store.assignments(run.id).length, count);
    assert.ok(store.assignments(run.id).every((a) => a.status === 'completed'));
    assert.deepEqual(visits, [...owners, ...owners.slice(0, -1).reverse()]);
    store.close();
  }

  /** Supplies deterministic outcomes while retaining the real persistence and dispatch path. */
  private scheduler(store: ExecutionStore, owners: string[], visits: string[]): Scheduler {
    return new Scheduler(store, async (assignment) => {
      visits.push(assignment.owner);
      const index = owners.indexOf(assignment.owner);
      if (!assignment.dependencies.length && index + 1 < owners.length)
        return {
          kind: 'request',
          requests: [
            {
              key: assignment.id,
              owner: owners[index + 1]!,
              objective: 'Supply dependency',
              acceptance: ['Works'],
            },
          ],
        };
      return { kind: 'completed', evidence: ['observed deterministic check'] };
    });
  }

  /** A yielding assignment rejoins the FIFO tail across writable store reopening. */
  async fairness(t: TestContext): Promise<void> {
    const path = this.database(t);
    let store = new ExecutionStore(path);
    const run = store.createRun('workday', ['a', 'b', 'c'], 'Fair dispatch');
    const first = store.enqueue(run.id, 'a', 'Many activations');
    const second = store.enqueue(run.id, 'b', 'Ready inbox work');
    await new Scheduler(store, async () => ({ kind: 'continue' })).step(run.id);
    store.close();
    store = new ExecutionStore(path);
    t.after(() => store.close());
    assert.deepEqual(
      store.ready(run.id).map((a) => a.id),
      [second.id, first.id],
    );
    const dependency = store.request(second.id, {
      key: 'supplier',
      owner: 'c',
      objective: 'Supply evidence',
      acceptance: ['Observed'],
    });
    store.complete(dependency.id, ['Observed evidence']);
    assert.deepEqual(
      store.ready(run.id).map((a) => a.id),
      [first.id, second.id],
    );
    store.updateAssignment(first.id, 'ready', { retained: true });
    assert.equal(store.ready(run.id)[0]!.id, first.id);
    await new Scheduler(store, async () => ({ kind: 'continue' })).step(run.id);
    assert.equal(store.ready(run.id)[0]!.id, second.id);
  }

  /** Rejects cycles and duplicate-key mutations without disturbing unrelated ready work. */
  dependencies(t: TestContext): void {
    const store = new ExecutionStore(this.database(t));
    t.after(() => store.close());
    const run = store.createRun('workday', ['a', 'b', 'c'], 'Stewardship');
    const a = store.enqueue(run.id, 'a', 'First');
    const c = store.enqueue(run.id, 'c', 'Unrelated');
    const request = { key: 'one', owner: 'b', objective: 'Supply', acceptance: ['Works'] };
    const b = store.request(a.id, request);
    assert.equal(store.request(a.id, request).id, b.id);
    assert.throws(() => store.request(a.id, { ...request, objective: 'Changed' }), /identity/i);
    assert.throws(() => store.link(b.id, a.id), /cycle/i);
    assert.ok(store.ready(run.id).some((item) => item.id === c.id));
    store.fail(b.id, 'rejected', 'Cannot supply');
    assert.equal(store.assignment(a.id).status, 'blocked');
    assert.equal(store.assignment(c.id).status, 'ready');
    assert.equal(store.enqueue(run.id, 'c', 'Another').owner, c.owner);
    assert.throws(
      () => store.request(c.id, { ...request, key: 'unknown', owner: 'missing' }),
      /owner/i,
    );
  }

  /** Uses a disposable private store and removes it after the scenario. */
  private database(t: TestContext): string {
    const directory = mkdtempSync(join(tmpdir(), 'arcnexus-scheduler-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    return join(directory, 'execution.sqlite');
  }
}

const scenarios = new SchedulerScenarios();

test('prepared scheduler receipts recover without replaying engineering or claiming delivery', (t) =>
  scenarios.prepared(t));

test('committed outcomes retire stale failure receipts without erasing history', (t) =>
  scenarios.currentReceipt(t));

for (const count of [2, 3, 5])
  test(`built scheduler delivers ${count} dynamically selected owners across reopening`, (t) =>
    scenarios.nested(t, count));

test('dependency identities, cycles and blocked owners preserve unrelated progress', (t) =>
  scenarios.dependencies(t));

test('continuations and dependency wakeups preserve durable FIFO fairness', (t) =>
  scenarios.fairness(t));

registerSuite({ component: 'execution-runtime', level: 'acceptance', tags: ['deterministic'] });
