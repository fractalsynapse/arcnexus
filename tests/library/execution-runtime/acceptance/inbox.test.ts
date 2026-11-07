import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import type { OwnerRequest } from '../../../../dist/library/coordination-store/execution-types.js';
import { Scheduler } from '../../../../dist/library/execution-runtime/scheduler.js';

/** Proves correlated inbox decisions and journal replay against the built durable store. */
class InboxScenarios {
  /** Cancellation preserves dependency waits and leaves unrelated work runnable without fabricating rejection. */
  async interruption(t: TestContext): Promise<void> {
    const store = this.store(t);
    const run = store.createRun('workday', ['a', 'b', 'c'], 'Retain dependencies');
    const a = store.enqueue(run.id, 'a', 'Root');
    const b = store.request(a.id, { key: 'b', owner: 'b', objective: 'Supply', acceptance: [] });
    const c = store.enqueue(run.id, 'c', 'Independent work');
    const cancellation = new AbortController();
    const scheduler = new Scheduler(store, async () => {
      cancellation.abort(new Error('Host shutdown'));
      throw cancellation.signal.reason;
    });
    await scheduler.step(run.id, cancellation.signal);
    assert.equal(store.assignment(b.id).status, 'interrupted');
    assert.equal(store.assignment(a.id).status, 'waiting');
    assert.equal(store.assignment(c.id).status, 'ready');
    await new Scheduler(store, async () => ({
      kind: 'completed',
      evidence: ['controlled check'],
    })).step(run.id);
    assert.equal(store.assignment(c.id).status, 'completed');
    assert.equal(store.assignment(a.id).status, 'waiting');
  }

  /** Keeps accepted intent distinct from delivery and atomically rolls back invalid fan-out. */
  milestones(t: TestContext): void {
    const store = this.store(t);
    const run = store.createRun('task', ['a', 'b', 'c'], 'A goal');
    const a = store.enqueue(run.id, 'a', 'Root');
    const request = { key: 'b', owner: 'b', objective: 'Supply', acceptance: ['Observed'] };
    const b = store.request(a.id, { ...request, milestone: 'accepted' });
    assert.equal(store.assignment(a.id).status, 'waiting');
    store.accept(b.id);
    assert.equal(store.assignment(a.id).status, 'ready');
    assert.equal(store.assignment(b.id).status, 'ready');
    const c = store.request(a.id, { ...request, key: 'c', owner: 'c' });
    store.accept(c.id);
    assert.equal(store.assignment(a.id).status, 'waiting');
    store.complete(c.id, ['observed verification']);
    assert.equal(store.assignment(a.id).status, 'ready');
    const before = store.assignments(run.id).length;
    assert.throws(
      () =>
        store.requests(a.id, [
          { ...request, key: 'new' },
          { ...request, key: 'invalid', owner: 'missing' },
        ]),
      /owner/,
    );
    assert.equal(store.assignments(run.id).length, before);
  }

  /** Explicit review and document requests preserve their workflow without a file list. */
  recipientScope(t: TestContext): void {
    const store = this.store(t);
    const run = store.createRun('task', ['a', 'b'], 'A documentation goal');
    const a = store.enqueue(run.id, 'a', 'Root');
    store.updateAssignment(a.id, 'ready', {
      proposal: { kind: 'change', changeType: 'documentation' },
    });
    const request = {
      key: 'review',
      owner: 'b',
      objective: 'Review the delivered docs',
      acceptance: ['Observed'],
      kind: 'review' as const,
      changeType: null,
    };
    const b = store.request(a.id, request);
    assert.deepEqual(b.data.proposal, {
      kind: 'review',
      changeType: 'documentation',
    });
    assert.equal(store.request(a.id, request).id, b.id);
    const distinct = store.request(a.id, { ...request, key: 'distinct' });
    assert.notEqual(distinct.id, b.id);
    assert.equal(store.assignments(run.id).length, 3);
    assert.deepEqual(distinct.data.proposal, b.data.proposal);
  }

  /** Reuses an explicit supplier while retaining its accepted work and the requester's purpose. */
  sharedScope(t: TestContext): void {
    const store = this.store(t);
    const run = store.createRun('task', ['a', 'b'], 'Shared work');
    const a = store.enqueue(run.id, 'a', 'Root');
    const b = store.enqueue(run.id, 'b', 'Review', ['Canonical review evidence']);
    store.updateAssignment(b.id, 'ready', {
      accepted: true,
      proposal: { kind: 'review', changeType: 'documentation' },
    });
    const canonical = store.assignment(b.id);
    const request = {
      key: 'shared',
      owner: 'b',
      objective: 'Use supplier findings for integration',
      acceptance: ['Requester integration purpose'],
      existingAssignmentId: b.id,
      kind: 'change' as const,
      changeType: 'behavior' as const,
    };
    assert.doesNotThrow(
      () => store.request(a.id, request),
      'Explicit supplier link must retain requester purpose',
    );
    assert.equal(store.request(a.id, request).id, b.id);
    assert.equal(store.assignments(run.id).length, 2);
    assert.deepEqual(store.assignment(b.id), canonical);
    assert.deepEqual(store.assignment(a.id).dependencies, [b.id]);
    this.sharedPurpose(store, a.id, request);
  }

  /** Checks that the durable inbox retains the original requester purpose and supplier relationship. */
  private sharedPurpose(store: ExecutionStore, sender: string, request: OwnerRequest): void {
    const messages = store.inbox(request.existingAssignmentId!);
    assert.equal(messages.length, 1);
    const message = messages[0]!;
    assert.ok(message.id);
    assert.equal(message.from, sender);
    assert.equal(message.assignmentId, request.existingAssignmentId);
    for (const [key, value] of Object.entries(request))
      assert.deepEqual(message[key as keyof typeof message], value);
  }

  /** Correlates clarification, retries and rejection without releasing undelivered dependents. */
  decisions(t: TestContext): void {
    const store = this.store(t);
    const run = store.createRun('task', ['a', 'b', 'c'], 'A goal');
    const a = store.enqueue(run.id, 'a', 'Root');
    const b = store.request(a.id, { key: 'b', owner: 'b', objective: 'Supply', acceptance: [] });
    const c = store.request(b.id, { key: 'c', owner: 'c', objective: 'Nested', acceptance: [] });
    const requestId = store.inbox(c.id)[0]!.id;
    const question = { requestId, action: 'clarify' as const, text: 'Which format?' };
    store.respond(c.id, [question]);
    store.respond(c.id, [question]);
    assert.equal((store.assignment(b.id).data.questions as unknown[]).length, 1);
    assert.throws(() => store.respond(a.id, [question]), /unauthorized/);
    const answer = { requestId, action: 'answer' as const, text: 'JSON' };
    store.respond(b.id, [answer]);
    store.respond(b.id, [answer]);
    assert.equal(store.assignment(c.id).status, 'ready');
    assert.equal(store.assignment(b.id).status, 'waiting');
    store.respond(c.id, [{ requestId, action: 'reject', text: 'Requires expanded authority' }]);
    assert.equal(store.assignment(a.id).status, 'blocked');
    assert.equal(store.assignment(b.id).status, 'blocked');
  }

  /** Retains exact correlated answers in the same inbox projection supplied to resumed workers. */
  conversation(t: TestContext): void {
    const store = this.store(t);
    const run = store.createRun('task', ['a', 'b'], 'A goal');
    const a = store.enqueue(run.id, 'a', 'Root');
    const b = store.request(a.id, { key: 'b', owner: 'b', objective: 'Supply', acceptance: [] });
    const requestId = store.inbox(b.id)[0]!.id;
    store.accept(b.id);
    store.respond(b.id, [{ requestId, action: 'clarify', text: 'Which format?' }]);
    store.respond(a.id, [{ requestId, action: 'answer', text: 'JSON with source locations' }]);
    const inbox = store.inbox(b.id)[0] as any;
    assert.deepEqual(
      inbox.replies.map((reply: any) => reply.text),
      ['Which format?', 'JSON with source locations'],
    );
    assert.equal(store.assignment(b.id).data.accepted, true);
    assert.equal(store.assignment(a.id).status, 'waiting');
    assert.deepEqual(store.assignment(b.id).evidence, []);
  }

  /** Late messages cannot undo a verified delivery or silently reopen recipient work. */
  terminal(t: TestContext): void {
    const store = this.store(t);
    const run = store.createRun('task', ['a', 'b'], 'A goal');
    const a = store.enqueue(run.id, 'a', 'Root');
    const b = store.request(a.id, { key: 'b', owner: 'b', objective: 'Supply', acceptance: [] });
    const requestId = store.inbox(b.id)[0]!.id;
    const accept = { requestId, action: 'accept' as const, text: 'Accepted scope' };
    store.respond(b.id, [accept]);
    store.complete(b.id, ['verified proof']);
    store.respond(b.id, [accept]);
    assert.throws(
      () => store.respond(b.id, [{ requestId, action: 'reject', text: 'Late' }]),
      /terminal/,
    );
    assert.equal(store.assignment(b.id).status, 'completed');
    assert.equal(store.assignment(a.id).status, 'ready');
  }

  /** Replays a retained scheduling outcome after a crash without executing the model twice. */
  async replay(t: TestContext): Promise<void> {
    const store = this.store(t);
    const run = store.createRun('task', ['a', 'b'], 'A goal');
    const a = store.enqueue(run.id, 'a', 'Root');
    const result = {
      kind: 'request' as const,
      receipt: 'checkpoint',
      requests: [{ key: 'durable', owner: 'b', objective: 'Supply', acceptance: [] }],
    };
    store.updateAssignment(a.id, 'ready', { pendingOutcome: result });
    store.requests(a.id, result.requests);
    store.updateAssignment(a.id, 'ready');
    const scheduler = new Scheduler(store, async () => {
      throw new Error('Must not replay model');
    });
    await scheduler.step(run.id);
    // A is waiting after the already committed request; recovery commits its retained outcome directly.
    scheduler.commit(a.id, result);
    assert.equal(store.assignments(run.id).length, 2);
    assert.equal(store.assignment(a.id).data.lastReceipt, 'checkpoint');
    assert.equal(store.assignment(a.id).data.pendingOutcome, null);
  }

  /** Duplicate crash-recovery delivery cannot rewind the accumulated candidate after later verified work. */
  promotions(t: TestContext): void {
    const store = this.store(t);
    const first = store.createRun('task', ['a'], 'First');
    const second = store.createRun('task', ['a'], 'Second');
    for (const run of [first, second])
      store.updateRun(run.id, 'running', { authorityBase: 'base', packageId: 'package' });
    const a = store.enqueue(first.id, 'a', 'First change');
    const b = store.enqueue(second.id, 'a', 'Next change');
    const candidate = { candidateRevision: 'first', verifiedEvidence: ['first proof'] };
    store.complete(a.id, ['first proof'], candidate);
    store.complete(b.id, ['second proof'], {
      candidateRevision: 'second',
      verifiedEvidence: ['second proof'],
    });
    const scheduler = new Scheduler(store, async () => {
      throw new Error('No model replay');
    });
    scheduler.commit(a.id, { kind: 'completed', evidence: ['first proof'], candidate });
    assert.equal(store.latestDelivery('base', 'package')!.data.candidateRevision, 'second');
    assert.equal(store.assignment(a.id).status, 'completed');
    assert.throws(() => store.complete(a.id, ['forged proof'], candidate), /disagrees/);
  }

  /** Accepted intent removes an active wait while historical edges remain visible. */
  historicalCycle(t: TestContext): void {
    const store = this.store(t);
    const run = store.createRun('task', ['a', 'b'], 'A goal');
    const a = store.enqueue(run.id, 'a', 'Root');
    const b = store.request(a.id, {
      key: 'b',
      owner: 'b',
      objective: 'Supply',
      acceptance: [],
      milestone: 'accepted',
    });
    store.accept(b.id);
    store.request(b.id, {
      key: 'a',
      owner: 'a',
      objective: 'Root',
      acceptance: [],
      existingAssignmentId: a.id,
    });
    assert.deepEqual(
      store.ready(run.id).map((item) => item.id),
      [a.id],
    );
    store.complete(a.id, ['root evidence']);
    assert.equal(store.assignment(b.id).status, 'ready');
    store.complete(b.id, ['supplier evidence']);
    assert.deepEqual(store.assignment(a.id).dependencies, [b.id]);
    assert.deepEqual(store.assignment(b.id).dependencies, [a.id]);
  }

  /** Unsatisfied delivery cycles still fail without persisting half of a request exchange. */
  blockingCycle(t: TestContext): void {
    const store = this.store(t);
    const run = store.createRun('task', ['a', 'b'], 'A goal');
    const a = store.enqueue(run.id, 'a', 'Root');
    const b = store.request(a.id, { key: 'b', owner: 'b', objective: 'Supply', acceptance: [] });
    assert.throws(
      () =>
        store.request(b.id, {
          key: 'a',
          owner: 'a',
          objective: 'Root',
          acceptance: [],
          existingAssignmentId: a.id,
        }),
      /Blocking dependency cycle/,
    );
    assert.deepEqual(store.assignment(b.id).dependencies, []);
    assert.equal(store.inbox(b.id).length, 1);
    assert.equal(store.assignment(a.id).status, 'waiting');
  }

  /** Linking shared work cannot weaken an earlier requirement for verified delivery. */
  sharedMilestones(t: TestContext): void {
    const store = this.store(t);
    const run = store.createRun('task', ['a', 'b'], 'A goal');
    const a = store.enqueue(run.id, 'a', 'Root');
    const request = { key: 'delivery', owner: 'b', objective: 'Supply', acceptance: [] };
    const b = store.request(a.id, request);
    store.request(a.id, {
      ...request,
      key: 'intent',
      existingAssignmentId: b.id,
      milestone: 'accepted',
    });
    store.accept(b.id);
    assert.equal(store.assignment(a.id).status, 'waiting');
    assert.throws(() => store.complete(a.id, ['premature proof']), /Undelivered/);
    store.complete(b.id, ['verified supplier']);
    assert.equal(store.assignment(a.id).status, 'ready');
  }

  /** Creates a private store with deterministic cleanup. */
  private store(t: TestContext): ExecutionStore {
    const directory = mkdtempSync(join(tmpdir(), 'arcnexus-inbox-'));
    const store = new ExecutionStore(join(directory, 'execution.sqlite'));
    t.after(() => {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    });
    return store;
  }
}

const scenarios = new InboxScenarios();

test('inbox acceptance milestones and atomic fan-out', (t) => scenarios.milestones(t));

test('correlated clarification and transitive rejection', (t) => scenarios.decisions(t));

test('durable scheduling outcomes deduplicate crash replay', (t) => scenarios.replay(t));

test('duplicate verified delivery cannot rewind the accumulated candidate', (t) =>
  scenarios.promotions(t));

test('inbox requests preserve explicit recipient workflow without a file list', (t) =>
  scenarios.recipientScope(t));

test('shared recipient work preserves canonical supplier fields and requester purpose', (t) =>
  scenarios.sharedScope(t));

test('accepted inbox requests retain correlated clarification answers', (t) =>
  scenarios.conversation(t));

test('late inbox replies cannot reopen verified deliveries', (t) => scenarios.terminal(t));

test('satisfied intent permits historical cycles without blocking delivery', (t) =>
  scenarios.historicalCycle(t));

test('unsatisfied cycles roll back their request exchange', (t) => scenarios.blockingCycle(t));

test('shared work retains the strongest required milestone', (t) => scenarios.sharedMilestones(t));

test('interrupted suppliers do not reject dependents or prevent unrelated delivery', (t) =>
  scenarios.interruption(t));

registerSuite({ component: 'execution-runtime', level: 'acceptance', tags: ['deterministic'] });
