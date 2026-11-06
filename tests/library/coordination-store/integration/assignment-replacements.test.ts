import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import type { AssignmentContinuation } from '../../../../dist/library/coordination-store/execution-types.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Drives replacement through actual admission, correlated messages, readiness and retained SQLite state. */
class ReplacementScenario {
  readonly store: ExecutionStore;

  readonly run;

  readonly sender;

  readonly first;

  readonly request = {
    key: 'original',
    owner: 'b',
    objective: 'Fix reported behavior',
    acceptance: ['Observed behavior passes'],
    kind: 'change' as const,
    milestone: 'accepted' as const,
  };

  /** Captures a failed supplier with an already propagated blocker and immutable evidence. */
  constructor(t: TestContext, mode: 'task' | 'workday' = 'task') {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-replacement-'));
    this.store = new ExecutionStore(join(root, 'execution.sqlite'));
    t.after(() => {
      this.store.close();
      rmSync(root, { recursive: true, force: true });
    });
    this.run = this.store.createRun(mode, ['a', 'b'], 'Verified delivery');
    this.sender = this.store.enqueue(this.run.id, 'a', 'Wait for the fix');
    this.first = this.store.request(this.sender.id, this.request);
    this.store.updateAssignment(this.first.id, 'running', { recordId: 'failed-record' });
    this.store.fail(this.first.id, 'failed', 'Diagnosed workflow failure');
  }

  /** Original evidence and scope survive retries, clarification and a second replacement. */
  chain(): void {
    const decision = this.decision(this.first.id);
    this.admit(decision);
    const second = this.store.effective(this.first.id);
    this.admit(decision);
    assert.equal(this.store.assignments(this.run.id).length, 3);
    const old = this.store.assignment(this.first.id);
    assert.equal(old.status, 'failed');
    assert.equal(old.data.recordId, 'failed-record');
    assert.equal(second.data.recordId, undefined);
    assert.deepEqual(second.acceptance, this.first.acceptance);
    assert.throws(() => this.store.complete(old.id, ['fabricated']), /immutable/);
    this.store.fail(second.id, 'blocked', 'Second diagnosed failure');
    this.admit(this.decision(second.id));
    const final = this.store.effective(old.id);
    assert.equal(final.data.replaces, second.id);
    assert.equal(this.store.request(this.sender.id, this.request).id, final.id);
    assert.equal(this.store.assignments(this.run.id).length, 4);
    this.delivery(final.id);
  }

  /** Only verified delivery releases the old waiter; the original envelope still accepts correlated replies. */
  private delivery(id: string): void {
    assert.throws(() => this.store.link(id, this.sender.id), /cycle/);
    const inbox = this.store.inbox(id);
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0]!.id, this.store.inbox(this.first.id)[0]!.id);
    assert.equal(inbox[0]!.requiredMilestone, 'delivered');
    this.store.respond(id, [{ requestId: inbox[0]!.id, action: 'accept', text: 'Will deliver' }]);
    assert.equal(this.store.assignment(this.sender.id).status, 'waiting');
    this.store.complete(id, ['verified result']);
    assert.equal(this.store.assignment(this.sender.id).status, 'ready');
    assert.deepEqual(this.store.assignment(this.sender.id).dependencies, [id]);
  }

  /** Replacing accepted intent cannot turn a previously nonblocking loop into a deadlock. */
  cycle(): void {
    this.store.admitDirection(
      this.run.id,
      [],
      [{ assignmentId: this.first.id, ownerId: 'b', reason: 'Review the retained blocker' }],
      {},
    );
    this.store.accept(this.first.id);
    this.store.link(this.first.id, this.sender.id);
    this.store.fail(this.first.id, 'failed', 'Needs a new workflow');
    assert.throws(() => this.admit(this.decision(this.first.id)), /cycle/);
    assert.equal(this.store.effective(this.first.id).id, this.first.id);
    assert.equal(this.store.assignments(this.run.id).length, 2);
  }

  /** A conflicting request or cross-owner directive must leave every prior relationship intact. */
  refuse(): void {
    const decision = this.decision(this.first.id);
    assert.throws(() => this.admit({ ...decision, ownerId: 'a' }), /same owner/);
    assert.equal(this.store.assignments(this.run.id).length, 2);
    this.admit(decision);
    assert.throws(
      () => this.admit({ ...decision, reason: 'Different diagnosis' }),
      /different replacement/,
    );
    assert.equal(this.store.assignments(this.run.id).length, 3);
  }

  /** Uses the same atomic admission entry point as production direction. */
  private admit(decision: AssignmentContinuation): void {
    this.store.admitDirection(this.run.id, [], [decision], {});
  }

  /** Requests a fresh workflow without selecting files, changing ownership or dropping acceptance. */
  private decision(id: string): AssignmentContinuation {
    return {
      assignmentId: id,
      ownerId: 'b',
      reason: 'Behavior already exists; characterize it',
      replacementChangeType: 'refactor',
    };
  }
}

test('explicit replacements preserve failed evidence and wait for verified chain delivery', (t) =>
  new ReplacementScenario(t).chain());

test('workday replacements preserve failed evidence and verified dependency milestones', (t) =>
  new ReplacementScenario(t, 'workday').chain());

test('conflicting and cross-owner replacements roll back admission', (t) =>
  new ReplacementScenario(t).refuse());

test('replacement refuses a newly blocking milestone cycle before admission', (t) =>
  new ReplacementScenario(t).cycle());

registerSuite({
  component: 'coordination-store',
  level: 'integration',
  tags: ['deterministic', 'recovery'],
});
