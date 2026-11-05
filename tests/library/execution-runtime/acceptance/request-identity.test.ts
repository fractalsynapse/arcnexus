import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { Scheduler } from '../../../../dist/library/execution-runtime/scheduler.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { readSchema } from '../../../../dist/library/architecture/schema.js';

/** Exercises actual request transactions and scheduler failure isolation with controlled activation results. */
class RequestIdentityScenario {
  readonly store: ExecutionStore;

  readonly run;

  readonly sender;

  readonly supplier;

  /** Creates one current run and two genuine assignments in private durable storage. */
  constructor(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-request-identity-'));
    this.store = new ExecutionStore(join(root, 'execution.sqlite'));
    t.after(() => {
      this.store.close();
      rmSync(root, { recursive: true, force: true });
    });
    this.run = this.store.createRun('task', ['a', 'b'], 'Controlled goal');
    this.sender = this.store.enqueue(this.run.id, 'a', 'Request work');
    this.supplier = this.store.enqueue(this.run.id, 'b', 'Supply', ['Observed']);
  }

  /** Rejects unknown, requester, cross-owner and cross-run identities before persisting a dependency. */
  invalid(): void {
    const foreign = this.store.createRun('task', ['b'], 'Foreign goal');
    const other = this.store.enqueue(foreign.id, 'b', 'Supply', ['Observed']);
    for (const id of ['simulation:issue:task:tracking', this.sender.id, other.id, '']) {
      assert.throws(() => this.store.request(this.sender.id, this.request(id)), {
        name: 'DependencyBlocked',
        message: /assignmentId=null.*Tracking issue/,
      });
      assert.deepEqual(this.store.assignment(this.sender.id).dependencies, []);
      assert.deepEqual(this.store.inbox(this.sender.id), []);
    }
    assert.equal(
      this.store.request(this.sender.id, this.request(this.supplier.id)).id,
      this.supplier.id,
    );
  }

  /** Keeps failed fan-out atomic, preserves rejected intent and lets unrelated ready work finish. */
  async scheduled(): Promise<void> {
    const requests = [
      { ...this.request(undefined), key: 'new' },
      this.request('simulation:issue:task:tracking'),
    ];
    const result = { kind: 'request' as const, requests };
    await new Scheduler(this.store, async () => result).step(this.run.id);
    const rejected = this.store.assignment(this.sender.id);
    assert.equal(rejected.status, 'blocked');
    assert.deepEqual(rejected.data.lastFailedOutcome, JSON.parse(JSON.stringify(result)));
    assert.match(String(rejected.data.reason), /Invalid supplier assignment/);
    assert.deepEqual(this.store.inbox(this.sender.id), []);
    assert.equal(this.store.assignments(this.run.id).length, 2);
    await new Scheduler(this.store, async () => ({
      kind: 'completed',
      evidence: ['Controlled independent result'],
    })).step(this.run.id);
    assert.equal(this.store.assignment(this.supplier.id).status, 'completed');
    assert.equal(this.store.assignment(this.sender.id).status, 'blocked');
  }

  /** Specifies deliberate sharing with the supplier's exact accepted scope. */
  private request(existingAssignmentId: string | undefined) {
    return {
      key: 'link',
      owner: 'b',
      objective: 'Supply',
      acceptance: ['Observed'],
      existingAssignmentId,
    };
  }
}

test('dependency links distinguish supplier assignments from other resource identities', (t) =>
  new RequestIdentityScenario(t).invalid());

test('invalid dependency fan-out blocks honestly while unrelated work completes', (t) =>
  new RequestIdentityScenario(t).scheduled());

test('active request schema explains null and explicit supplier identity', () => {
  const description =
    readSchema('general-agent-result').properties.requests.items.properties.assignmentId
      .description;
  assert.match(description, /null to request new recipient work/);
  assert.match(description, /matching owner, objective, acceptance and scope/);
  assert.match(description, /Never use a tracking issue ID/);
});

registerSuite({ component: 'execution-runtime', level: 'acceptance', tags: ['deterministic'] });
