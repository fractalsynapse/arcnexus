import { nativeHostTest } from '../../testing/support/general-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
  /** Checks omitted execution limits remain unconfigured in the captured assignment. */
  absent(t: TestContext, schemaVersion: number): void {
    const fixture = workflowFixture(t);
    const path = join(fixture.repo, 'architecture/execution-profiles/luna.yaml');
    const profile = JSON.parse(readFileSync(path, 'utf8'));
    profile.schemaVersion = schemaVersion;
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
    const result = spawnSync(
      process.execPath,
      [cli, 'inspect', 'sample', 'Improve behavior', '--project', fixture.repo, '--json'],
      { encoding: 'utf8', timeout: 30 * 60 * 1000 },
    );
    assert.equal(result.status, 0, result.stderr);
    const resolved = JSON.parse(result.stdout);
    for (const key of ['timeoutSeconds', 'commandTimeoutSeconds', 'maxTurns', 'maxOperationCalls'])
      assert.equal(resolved.executionProfile[key], undefined);
  }

  /** Verifies that unconfigured turn and attempt quotas permit a verified fourth implementation attempt. */
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
      assert.equal(record.implementationAttempts, 4);
      assert.equal(record.turns.length, 7);
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

for (const version of [1, 2, 3])
  test(`schema ${version} missing execution limits remain unconfigured`, (t) =>
    suite.absent(t, version));

nativeHostTest('minimal execution completes without caller-authored quotas', (t) =>
  suite.noCallerQuotas(t),
);

nativeHostTest('unconfigured operation quota permits more than twenty-four successful calls', (t) =>
  suite.continuingWork(t, true),
);

nativeHostTest(
  'unconfigured turn and attempt quotas permit a verified fourth implementation attempt',
  (t) => suite.continuingWork(t, false),
);

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
