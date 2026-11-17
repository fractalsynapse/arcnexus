import assert from 'node:assert/strict';
import test from 'node:test';
import type { CheckResult } from '../../src/check.js';
import { ownerReviewObservations } from '../../src/review-observations.js';
import type { StewardScope } from '../../src/steward-check.js';

/** Model recorded native observations around the last candidate edit. */
class ReviewObservationsScenario {
  /** Preserve an earlier failed check without presenting it as current evidence. */
  static run() {
    const scope: StewardScope = { owner: 'execution', activity: 'testing' };
    const old = this.check('owner-tests', 1, 'old.log');
    const current = this.check('owner-tests', 0, 'current.log');
    const history = [
      { check: old, scope },
      { editIntent: [{ path: 'src/index.ts' }] },
      { check: current, scope },
      { check: this.check('repository-tests', 0, 'assembly.log') },
    ];
    assert.deepEqual(ownerReviewObservations(history), [
      { scope, check: old, afterLastEdit: false },
      { scope, check: current, afterLastEdit: true },
    ]);
  }

  /** Supply both the exit observation and its separately retained log. */
  private static check(id: string, status: number, log: string): CheckResult {
    return { id, status, log, command: 'npm', args: ['test'], cwd: '/repo', durationMs: 1 };
  }
}

test('independent review receives exact owner check results with edit freshness', () =>
  ReviewObservationsScenario.run());
