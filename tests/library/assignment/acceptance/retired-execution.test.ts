import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { SessionState } from '../../../../dist/library/assignment/session-state.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest } from '../../testing/support/general-fixture.js';
import { minimalWorkflowFixture } from '../../testing/support/workflow-fixture.js';

/** Rejects obsolete executable authority while sharing the same durable dispatcher in every session entry. */
class RetiredAssignmentScenarios {
  /** Rejects an old owner before reading source or materializing any acceptance input. */
  owner(): void {
    this.reject({ context: [{ schemaVersion: 4 }] }, /version.five.*migrat/i);
  }

  /** Direct library entry cannot restore a quota hidden in a captured historical profile. */
  budget(): void {
    this.reject(
      {
        context: [{ schemaVersion: 5 }],
        executionProfile: { id: 'legacy', schemaVersion: 2, maxTurns: 1 },
      },
      /obsolete work budget maxTurns/,
    );
  }

  /** The standalone session finishes through persisted stages rather than a separate whole-workflow loop. */
  durable(t: TestContext): void {
    const fixture = minimalWorkflowFixture(t);
    const result = fixture.run();
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.continuation, true);
    assert.equal(record.safeCheckpoint, true);
    assert.equal(record.nextStage, 'finished');
    assert.ok(record.checkpointSequence >= 4);
    assert.equal(record.executionLimits, undefined);
  }

  /** Uses deliberately incomplete records to prove rejection precedes filesystem access. */
  private reject(resolvedAssignment: unknown, expected: RegExp): void {
    assert.throws(() => new SessionState({ record: { resolvedAssignment } } as any), expected);
  }
}

const scenarios = new RetiredAssignmentScenarios();

test('assignment execution rejects historical owner authority before preparation', () =>
  scenarios.owner());

test('assignment execution rejects captured historical quotas before preparation', () =>
  scenarios.budget());

nativeHostTest(
  'standalone assignment uses durable stage checkpoints without execution budgets',
  (t) => scenarios.durable(t),
);

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
