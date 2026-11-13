import { nativeHostTest } from '../../testing/support/general-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { minimalOperationFixture as operationFixture } from '../../testing/support/operations-fixture.js';
import {
  cli,
  workflowFixture,
  minimalWorkflowFixture,
} from '../../testing/support/workflow-fixture.js';

/** Exercises execution limit behavior through observable scenarios. */
class ExecutionLimitTests {
  /**
   * Omitted execution limits stay unconfigured, so the host cannot act on an invented budget.
   *
   * Limits are optional in the one profile shape the product accepts, which is what makes this a
   * real question: a document that leaves them out must resolve to nothing rather than to defaults
   * the runtime quietly supplied.
   */
  omitted(t: TestContext): void {
    const fixture = workflowFixture(t);
    this.stripLimits(fixture);
    const resolved = JSON.parse(this.inspect(fixture).stdout);
    for (const key of [
      'timeoutSeconds',
      'commandTimeoutSeconds',
      'maxTurns',
      'maxCorrectiveTurns',
      'maxOperationCalls',
    ])
      assert.equal(resolved.executionProfile[key], undefined, `${key} was invented`);
  }

  /** A profile document in a superseded shape is refused outright, never migrated. */
  superseded(t: TestContext): void {
    const fixture = workflowFixture(t);
    this.stripLimits(fixture, 2);
    const result = this.inspect(fixture, false);
    assert.equal(result.status, 2, result.stdout);
    assert.match(result.stderr, /luna\.yaml|execution-profile/i, result.stderr);
  }

  /** Removes the optional limits from the authored profile, optionally restating its version. */
  private stripLimits(fixture: ReturnType<typeof workflowFixture>, schemaVersion?: number): void {
    const path = join(fixture.repo, '.arc/architecture/execution-profiles/luna.yaml');
    const profile = JSON.parse(readFileSync(path, 'utf8'));
    if (schemaVersion !== undefined) profile.schemaVersion = schemaVersion;
    for (const key of [
      'timeoutSeconds',
      'commandTimeoutSeconds',
      'maxTurns',
      'maxCorrectiveTurns',
      'maxOperationCalls',
    ])
      delete profile[key];
    writeFileSync(path, JSON.stringify(profile));
    fixture.commit();
  }

  /** Runs the built CLI's inspection against the fixture repository. */
  private inspect(
    fixture: ReturnType<typeof workflowFixture>,
    expectSuccess = true,
  ): SpawnSyncReturns<string> {
    const result = spawnSync(
      process.execPath,
      [cli, 'inspect', 'sample', 'Improve behavior', '--project', fixture.repo, '--json'],
      { encoding: 'utf8', timeout: 30 * 60 * 1000 },
    );
    if (expectSuccess) assert.equal(result.status, 0, result.stderr);
    return result;
  }

  /** Verifies that failed engineering prepares its contribution without a corrective-attempt allowance. */
  continuingWork(t: TestContext, operations: boolean): void {
    const fixture = operationFixture(t);
    fixture.configure(
      operations ? { operationRepeats: 25 } : { repairAfter: 3, operations: undefined },
    );
    const result = fixture.run(...(operations ? ['--kind', 'research'] : []));
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    if (operations) assert.equal(record.operationCalls, 25);
    else {
      assert.equal(record.implementationAttempts, 1);
      assert.equal(record.outcome, 'prepared_for_assembly');
      assert.equal(record.turns.length, 3);
    }
  }

  /** Completes a minimal assignment without caller-authored quota settings. */
  noCallerQuotas(t: TestContext): void {
    const fixture = minimalWorkflowFixture(t);
    const result = fixture.run();
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.implementationAttempts, 1);
    assert.equal(record.executionLimits, undefined);
  }
}

const suite = new ExecutionLimitTests();

test('omitted execution limits remain unconfigured rather than defaulted', (t) => suite.omitted(t));

test('a superseded execution profile is refused rather than migrated', (t) => suite.superseded(t));

nativeHostTest('minimal execution completes without caller-authored quotas', (t) =>
  suite.noCallerQuotas(t),
);

nativeHostTest('unconfigured operation quota permits more than twenty-four successful calls', (t) =>
  suite.continuingWork(t, true),
);

nativeHostTest(
  'failed engineering prepares its contribution without a corrective-attempt allowance',
  (t) => suite.continuingWork(t, false),
);

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
