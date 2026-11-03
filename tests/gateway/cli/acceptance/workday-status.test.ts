import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { RunQueryFixture } from '../support/run-query-fixture.js';

/** Verifies workday status selects retained identities without constructing an execution host. */
class WorkdayStatusScenarios {
  /** Reads an explicit or single active identity from outside Git while leaving SQLite bytes unchanged. */
  readonly(t: TestContext): void {
    const f = new RunQueryFixture(t);
    const { workday } = f.seed();
    const database = join(f.state, 'projects/first/execution.sqlite');
    const before = readFileSync(database);
    for (const args of [[], [workday.id]]) {
      const result = f.value('workday', 'status', ...args);
      assert.equal(result.workday.id, workday.id);
      assert.equal(result.workday.status, 'idle');
      assert.equal(result.observation, 'retained');
      assert.equal(result.tasks.length, 2);
      assert.ok(result.revision);
    }
    assert.deepEqual(readFileSync(database), before);
    assert.equal(existsSync(join(f.state, 'projects/first/host.json')), false);
  }

  /** Multiple applicable workdays require an explicit identity rather than selecting a global latest run. */
  ambiguous(t: TestContext): void {
    const f = new RunQueryFixture(t);
    const first = f.seed();
    const second = f.seed('second');
    const result = f.command('workday', 'status');
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /ambiguous/i);
    assert.equal(f.value('workday', 'status', first.workday.id).workday.id, first.workday.id);
    assert.equal(f.value('workday', 'status', second.workday.id).workday.id, second.workday.id);
  }
}

const scenarios = new WorkdayStatusScenarios();

test('workday status reads retained state without a host or checkout', (t) =>
  scenarios.readonly(t));

test('workday status rejects ambiguous implicit identities', (t) => scenarios.ambiguous(t));

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic', 'workday-status'] });
