import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { RunQueryFixture } from '../support/run-query-fixture.js';

/** Verifies workday status selects retained identities without constructing an execution host. */
class WorkdayStatusScenarios {
  /**
   * Reads a retained identity from outside Git without mutating state or building a host.
   *
   * The identity selection this scenario proves belongs to the delivered read surface: `workday status`
   * is reserved for a future self-directed loop (cli-gateway SS3, GW-11), so the observation moves to
   * `task get`, which renders the same retained authority. What must not change is that a status read is
   * read-only: the database bytes stay identical and no host file appears.
   */
  readonly(t: TestContext): void {
    const f = new RunQueryFixture(t);
    const { task } = f.seed();
    const database = join(f.state, 'projects/first/execution.sqlite');
    const before = readFileSync(database);
    const result = f.value('task', 'get', task.id);
    assert.equal(result.run.id, task.id);
    assert.ok(result.revision);
    assert.deepEqual(readFileSync(database), before);
    assert.equal(existsSync(join(f.state, 'projects/first/host.json')), false);
  }

  /**
   * Verifies the reserved verb refuses, and explicit identities still resolve.
   *
   * Ambiguity between two active identities was a property of the withheld `workday status` surface. That
   * command is now refused with its reservation reason, so this asserts the refusal and then reads each
   * seeded identity explicitly through the delivered surface — the selection guarantee stays covered
   * without pretending the withheld verb exists.
   */
  ambiguous(t: TestContext): void {
    const f = new RunQueryFixture(t);
    const first = f.seed();
    const second = f.seed('second');
    const refused = f.command('workday', 'status');
    assert.equal(refused.status, 2, refused.stderr);
    assert.match(
      refused.stderr,
      /workday status is not available in this build.*self-directed loop/i,
    );
    assert.equal(f.value('task', 'get', first.task.id).run.id, first.task.id);
    assert.equal(f.value('task', 'get', second.task.id).run.id, second.task.id);
  }
}

const scenarios = new WorkdayStatusScenarios();

test('a retained identity reads without a host or checkout on the delivered surface', (t) =>
  scenarios.readonly(t));

test('the reserved workday status refuses while explicit identities resolve', (t) =>
  scenarios.ambiguous(t));

registerSuite({ component: 'cli', level: 'acceptance', tags: ['deterministic', 'workday-status'] });
