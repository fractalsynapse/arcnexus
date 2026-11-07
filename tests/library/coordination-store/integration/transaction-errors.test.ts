import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import type { OwnerRequest } from '../../../../dist/library/coordination-store/execution-types.js';
import { ExecutionDatabase } from '../../../../dist/library/coordination-store/execution-database.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises primary failure identity and atomicity with a controlled secondary SQLite diagnostic. */
class TransactionFailureScenario {
  readonly directory = mkdtempSync(join(tmpdir(), 'arcnexus-transaction-errors-'));

  readonly database = new ExecutionDatabase(join(this.directory, 'execution.sqlite'));

  /** Keeps the real database and its cleanup confined to this scenario. */
  constructor(t: TestContext) {
    t.after(() => {
      this.database.close();
      rmSync(this.directory, { recursive: true, force: true });
    });
  }

  /** Simulates an already-aborted rollback without replacing ordinary SQLite writes or reads. */
  failRollback(t: TestContext): void {
    const original = DatabaseSync.prototype.exec;
    t.mock.method(DatabaseSync.prototype, 'exec', function (this: DatabaseSync, sql: string) {
      original.call(this, sql);
      if (sql === 'ROLLBACK') throw new Error('cannot rollback - no transaction is active');
    });
  }

  /** Requires the exact primary exception and no committed row or event after either failure path. */
  run(snapshot: boolean): void {
    const failure = Object.assign(new Error('database or disk is full'), { code: 'SQLITE_FULL' });
    const action = () => {
      if (!snapshot) this.database.put('probe', { id: 'uncommitted' });
      throw failure;
    };
    assert.throws(
      () =>
        snapshot ? this.database.snapshot(action) : this.database.transaction('probe', {}, action),
      (error) => error === failure,
    );
    assert.deepEqual(this.database.all('probe'), []);
    assert.deepEqual(this.database.events(0), []);
  }
}

test('transaction rollback failure preserves the primary storage error and atomicity', (t) => {
  const scenario = new TransactionFailureScenario(t);
  scenario.failRollback(t);
  scenario.run(false);
});

test('snapshot rollback failure preserves the primary storage error and atomicity', (t) => {
  const scenario = new TransactionFailureScenario(t);
  scenario.failRollback(t);
  scenario.run(true);
});

/** Exercises supplier links through real SQLite transactions and reopened public readers. */
class SupplierLinkScenario {
  readonly directory = mkdtempSync(join(tmpdir(), 'arcnexus-supplier-links-'));

  readonly path = join(this.directory, 'execution.sqlite');

  store = new ExecutionStore(this.path);

  readonly run = this.store.createRun('task', ['requester', 'supplier'], 'Compose contributions');

  readonly source = this.store.enqueue(this.run.id, 'requester', 'Integrate the contribution');

  readonly supplier = this.store.enqueue(this.run.id, 'supplier', 'Implement durable linking', [
    'Preserve canonical supplier authority',
  ]);

  readonly request: OwnerRequest = {
    key: 'runtime-contribution',
    owner: 'supplier',
    existingAssignmentId: this.supplier.id,
    objective: 'Use the store contribution in runtime admission',
    acceptance: ['Runtime can consume the public linking semantics'],
    kind: 'research',
    changeType: 'documentation',
    milestone: 'delivered',
  };

  /** Captures supplier workflow independently and closes every opened connection on cleanup. */
  constructor(t: TestContext) {
    this.store.updateAssignment(this.supplier.id, 'ready', {
      proposal: { kind: 'change', changeType: 'behavior' },
    });
    t.after(() => {
      this.store.close();
      rmSync(this.directory, { recursive: true, force: true });
    });
  }

  /** Requires different requester terms to link without changing canonical supplier authority. */
  reuse(): void {
    const canonical = this.store.assignment(this.supplier.id);
    assert.doesNotThrow(
      () => this.store.request(this.source.id, this.request),
      'explicit supplier link must accept requester purpose without copying supplier contract',
    );
    this.store.close();
    this.store = new ExecutionStore(this.path);
    assert.deepEqual(this.store.assignment(this.supplier.id), canonical);
    assert.equal(this.store.assignments(this.run.id).length, 2);
    assert.deepEqual(this.store.assignment(this.source.id).dependencies, [this.supplier.id]);
    const envelope = this.store.inbox(this.source.id)[0]!;
    assert.equal(envelope.assignmentId, this.supplier.id);
    assert.equal(envelope.objective, this.request.objective);
    assert.deepEqual(envelope.acceptance, this.request.acceptance);
    assert.equal(envelope.kind, this.request.kind);
    assert.equal(envelope.changeType, this.request.changeType);
    assert.equal(this.store.request(this.source.id, this.request).id, this.supplier.id);
    assert.equal(this.store.inbox(this.source.id).length, 1);
    this.rejectChangedReplay();
  }

  /** Keeps every caller term bound to the original request identity after restart. */
  private rejectChangedReplay(): void {
    for (const change of [
      { objective: 'Expanded requester purpose' },
      { acceptance: ['Different expectation'] },
      { kind: 'review' as const },
      { changeType: 'refactor' as const },
      { existingAssignmentId: this.source.id },
    ]) {
      assert.throws(
        () => this.store.request(this.source.id, { ...this.request, ...change }),
        /Request identity reused with different content/,
      );
    }
    assert.equal(this.store.inbox(this.source.id).length, 1);
    assert.equal(this.store.assignments(this.run.id).length, 2);
  }

  /** Requires invalid links to roll back earlier new work and all dependency/inbox state. */
  invalidLinks(): void {
    const foreign = this.store.createRun('task', ['supplier'], 'Foreign run');
    const foreignSupplier = this.store.enqueue(foreign.id, 'supplier', 'Other work');
    const before = this.snapshot();
    for (const change of [
      { existingAssignmentId: 'unknown-supplier' },
      { owner: 'requester' },
      { existingAssignmentId: foreignSupplier.id },
      { owner: 'requester', existingAssignmentId: this.source.id },
    ]) {
      assert.throws(
        () =>
          this.store.requests(this.source.id, [
            { key: 'new-first', owner: 'supplier', objective: 'Distinct work', acceptance: [] },
            { ...this.request, ...change },
          ]),
        /Invalid supplier assignment|self|cycle|owner/i,
      );
      assert.deepEqual(this.snapshot(), before);
    }
  }

  /** Preserves cycle rejection while distinct requests still create independent supplier work. */
  cyclesAndNewWork(): void {
    this.store.link(this.supplier.id, this.source.id);
    const before = this.snapshot();
    assert.throws(
      () => this.store.request(this.source.id, this.request),
      /Blocking dependency cycle/,
    );
    assert.deepEqual(this.snapshot(), before);
    const newWork = {
      owner: 'supplier',
      objective: 'Distinct new contribution',
      acceptance: ['New result'],
      kind: 'research' as const,
      changeType: 'documentation' as const,
    };
    const first = this.store.request(this.source.id, { ...newWork, key: 'new-one' });
    const second = this.store.request(this.source.id, { ...newWork, key: 'new-two' });
    assert.notEqual(first.id, second.id);
    assert.notEqual(first.id, this.supplier.id);
    assert.deepEqual(first.data.proposal, { kind: 'research', changeType: 'documentation' });
    assert.equal(this.store.assignments(this.run.id).length, 4);
    assert.equal(this.store.request(this.source.id, { ...newWork, key: 'new-one' }).id, first.id);
  }

  /** Captures all observable state affected by a transactional request exchange. */
  private snapshot() {
    return {
      assignments: this.store.assignments(this.run.id),
      requests: this.store.inbox(this.source.id),
      events: this.store.events(),
    };
  }
}

test('explicit supplier links retain canonical scope and durable requester purpose', (t) =>
  new SupplierLinkScenario(t).reuse());

test('invalid explicit supplier identities roll back the complete request batch', (t) =>
  new SupplierLinkScenario(t).invalidLinks());

test('supplier link cycles roll back while distinct new work remains distinct', (t) =>
  new SupplierLinkScenario(t).cyclesAndNewWork());

registerSuite({ component: 'coordination-store', level: 'integration', tags: ['deterministic'] });
