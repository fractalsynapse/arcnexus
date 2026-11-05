import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
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

registerSuite({ component: 'coordination-store', level: 'integration', tags: ['deterministic'] });
