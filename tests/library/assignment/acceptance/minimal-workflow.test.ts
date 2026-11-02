import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { minimalWorkflowFixture } from '../../testing/support/workflow-fixture.js';

/** Keeps engineering characterization on minimal authority, actual confinement and checked edits. */
class MinimalWorkflowScenarios {
  /** Plans, observes an expected failing regression and completes through host-mediated source transactions. */
  engineering(t: TestContext): void {
    const fixture = minimalWorkflowFixture(t);
    const result = fixture.run();
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.outcome, 'ready_for_integration');
    assert.deepEqual(
      record.turns.map((turn: any) => turn.activity),
      ['planning', 'specification', 'implementation', 'review'],
    );
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'after');
    assert.equal(readdirSync(join(fixture.state, 'runs', record.id, 'checked-edits')).length, 2);
    assert.equal(record.regressionCheckpoint.operationId, 'verify');
    assert.equal(record.regressionCheckpoint.verificationIndex, undefined);
    assert.ok(record.operationInvocations.some((op: any) => op.result?.exitCode === 1));
    assert.equal(record.operationInvocations.at(-1).result.exitCode, 0);
    assert.ok(record.operationInvocations.every((op: any) => op.definitionDigest));
  }

  /** Preserves the read-only workflow without direct source permission or an artificial change template. */
  research(t: TestContext): void {
    const fixture = minimalWorkflowFixture(t);
    const result = fixture.run('--kind', 'research');
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.outcome, 'research_completed');
    assert.deepEqual(record.changes, []);
    assert.deepEqual(
      record.turns.map((turn: any) => turn.activity),
      ['planning', 'research'],
    );
    assert.ok(record.operationInvocations.every((op: any) => op.status === 'completed'));
  }
}

const scenarios = new MinimalWorkflowScenarios();

test('minimal engineering uses checked edits and shared expected-red verification', (t) =>
  scenarios.engineering(t));

test('minimal read-only research retains planning and shared verification', (t) =>
  scenarios.research(t));

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
