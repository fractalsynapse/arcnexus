import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DirectionEvidence } from '../../../../dist/library/task-intake/direction-evidence.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Checks the lifecycle information a real director receives before an activation has a checkpoint. */
class ContinuationEligibilityScenarios {
  /** Ready work accepts feedback while active, waiting, retired and completed work cannot restart. */
  project(): void {
    const evidence = new DirectionEvidence('/unused', 'run');
    const assignments = [
      'ready',
      'running',
      'waiting',
      'completed',
      'interrupted',
      'blocked',
      'failed',
      'rejected',
    ].map((status) => ({ runId: 'run', status, data: {} }));
    const result = evidence.capture([
      ...assignments,
      { runId: 'run', status: 'failed', data: { replacedBy: 'successor' } },
    ]) as Array<{ checkpointEvidence: { continuation: { eligible: boolean } } }>;
    assert.deepEqual(
      result.map((item) => item.checkpointEvidence.continuation.eligible),
      [true, false, false, false, false, true, true, true, false],
    );
  }
}

test('director eligibility permits ready feedback and distinguishes waiting from failed work', () =>
  new ContinuationEligibilityScenarios().project());

registerSuite({ component: 'task-intake', level: 'unit', tags: ['deterministic', 'continuation'] });
