import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Strengthens an existing request milestone without duplicating its accepted assignment contract. */
class DeliveryWaitScenarios {
  /** Retries preserve one assignment, unchanged scope, and a wait that only verified delivery releases. */
  waiting(t: TestContext): void {
    const { store, run, a, b, action } = this.fixture(t);
    const unrelated = store.enqueue(run.id, 'c', 'Unrelated work');
    const before = store.assignment(b.id);
    store.respond(a.id, [action]);
    store.respond(a.id, [action]);
    assert.equal(store.assignment(a.id).status, 'waiting');
    assert.equal(store.assignment(unrelated.id).status, 'ready');
    assert.deepEqual(store.assignment(b.id), before);
    assert.equal(store.assignments(run.id).length, 3);
    assert.equal(store.inbox(a.id)[0]!.replies.length, 1);
    assert.throws(() => store.complete(a.id, ['premature']), /Undelivered dependencies/);
    store.accept(b.id);
    assert.equal(store.assignment(a.id).status, 'waiting');
    store.complete(b.id, ['independent verified delivery']);
    assert.equal(store.assignment(a.id).status, 'ready');
  }

  /** A newly blocking cycle rolls back the milestone, reply and readiness changes atomically. */
  cycle(t: TestContext): void {
    const { store, a, b, action } = this.fixture(t);
    store.link(b.id, a.id);
    assert.throws(() => store.respond(a.id, [action]), /Blocking dependency cycle/);
    assert.equal((store.assignment(a.id).data.milestones as any)[b.id], 'accepted');
    assert.equal(store.assignment(a.id).status, 'ready');
    assert.equal(store.inbox(a.id)[0]!.replies.length, 0);
  }

  /** Recipient identities cannot change requester waits, and completed delivery is already sufficient. */
  authority(t: TestContext): void {
    const { store, a, b, action } = this.fixture(t);
    assert.throws(() => store.respond(b.id, [action]), /unauthorized sender/);
    store.complete(b.id, ['verified delivery']);
    store.respond(a.id, [action]);
    assert.equal(store.assignment(a.id).status, 'ready');
    store.complete(a.id, ['verified integration']);
    store.respond(a.id, [action]);
    assert.equal(store.assignment(a.id).status, 'completed');
    assert.throws(() => store.respond(a.id, [{ ...action, text: 'Another wait' }]), /terminal/);
  }

  /** Context distinguishes sender authority, pending questions and already delivered dependencies. */
  context(t: TestContext): void {
    const { store, a, b, action } = this.fixture(t);
    const envelope = (id: string): any => store.inbox(id)[0];
    assert.equal(envelope(a.id).direction, 'outgoing');
    assert.equal(envelope(b.id).direction, 'incoming');
    assert.deepEqual(envelope(a.id).availableActions, ['require_delivery', 'feedback']);
    assert.deepEqual(envelope(b.id).availableActions, ['reject', 'clarify']);
    store.respond(b.id, [{ ...action, action: 'clarify', text: 'Which format?' }]);
    assert.deepEqual(envelope(a.id).availableActions, ['answer', 'require_delivery']);
    assert.deepEqual(envelope(b.id).availableActions, ['reject']);
    store.respond(a.id, [{ ...action, action: 'answer', text: 'JSON' }]);
    store.respond(a.id, [action]);
    assert.deepEqual(envelope(a.id).availableActions, ['feedback']);
    assert.equal(envelope(a.id).requiredMilestone, 'delivered');
    store.complete(b.id, ['independent verification']);
    assert.equal(envelope(a.id).recipientStatus, 'completed');
    assert.deepEqual(envelope(a.id).availableActions, []);
    assert.deepEqual(envelope(b.id).availableActions, []);
  }

  /** Creates accepted intent with a stable request identity and isolated durable storage. */
  private fixture(t: TestContext) {
    const directory = mkdtempSync(join(tmpdir(), 'arcnexus-delivery-wait-'));
    const store = new ExecutionStore(join(directory, 'execution.sqlite'));
    t.after(() => {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    });
    const run = store.createRun('task', ['a', 'b', 'c'], 'Bounded goal');
    const a = store.enqueue(run.id, 'a', 'Integrate');
    const b = store.request(a.id, {
      key: 'supplier',
      owner: 'b',
      objective: 'Supply API',
      acceptance: ['API works'],
      milestone: 'accepted',
    });
    store.accept(b.id);
    const action: any = {
      requestId: store.inbox(a.id)[0]!.id,
      action: 'require_delivery',
      text: 'Implementation needs verified API delivery',
    };
    return { store, run, a, b, action };
  }
}

const scenarios = new DeliveryWaitScenarios();

test('delivery waits preserve accepted scope and deduplicate retries', (t) => scenarios.waiting(t));

test('delivery milestone cycle rejection rolls back the entire transition', (t) =>
  scenarios.cycle(t));

test('delivery waits enforce requester authority and respect completed work', (t) =>
  scenarios.authority(t));

test('inbox context exposes only applicable assignment-relative actions', (t) =>
  scenarios.context(t));

registerSuite({ component: 'execution-runtime', level: 'acceptance', tags: ['deterministic'] });
