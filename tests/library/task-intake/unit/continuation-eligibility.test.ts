import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DirectionEvidence } from '../../../../dist/library/task-intake/direction-evidence.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Checks the lifecycle information a real director receives before an activation has a checkpoint. */
class ContinuationEligibilityScenarios {
  /** Unstarted ready/waiting work accepts feedback; active, interrupted and completed work cannot reopen. */
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
      [true, false, true, false, false, true, true, true, false],
    );
  }

  /** Waiting status cannot substitute for a missing retained checkpoint once execution has started. */
  missingCheckpoint(): void {
    const evidence = new DirectionEvidence('/unused', 'run');
    const result = evidence.capture([
      {
        runId: 'run',
        status: 'waiting',
        data: { recordId: '00000000-0000-0000-0000-000000000000' },
      },
    ]) as Array<{
      checkpointEvidence: { continuation: { eligible: boolean }; evidenceUnavailable: boolean };
    }>;
    assert.equal(result[0]!.checkpointEvidence.continuation.eligible, false);
    assert.equal(result[0]!.checkpointEvidence.evidenceUnavailable, true);
  }
}

test('director eligibility permits feedback on unstarted ready and waiting work', () =>
  new ContinuationEligibilityScenarios().project());

test('waiting work with unavailable retained evidence cannot continue', () =>
  new ContinuationEligibilityScenarios().missingCheckpoint());

registerSuite({ component: 'task-intake', level: 'unit', tags: ['deterministic', 'continuation'] });
