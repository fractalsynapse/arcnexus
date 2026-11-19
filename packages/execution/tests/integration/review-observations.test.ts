import assert from 'node:assert/strict';
import test from 'node:test';
import type { CheckResult } from '../../src/check.js';
import { ownerEvidenceDigest, ownerReviewObservations } from '../../src/review-observations.js';
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
    const candidate = { tree: 'current-tree', base: 'base-revision' };
    const operation = { id: 'owner-tests', name: 'Owner tests', category: 'test', network: false };
    const observations = ownerReviewObservations(history, candidate, { 'owner-tests': operation });
    assert.deepEqual(observations, [
      { scope, check: old, afterLastEdit: false },
      { scope, check: current, afterLastEdit: true, candidate, operation },
    ]);
    const record = observations[1]!;
    const digest = ownerEvidenceDigest(observations, candidate.tree);
    assert(digest);
    const repeat = { ...record, check: { ...current, durationMs: 4, log: 'another-run.log' } };
    assert.equal(ownerEvidenceDigest([repeat], candidate.tree), digest);
    const changed = { ...record, check: { ...current, status: 1 } };
    assert.notEqual(ownerEvidenceDigest([changed], candidate.tree), digest);
  }

  /** Supply both the exit observation and its separately retained log. */
  private static check(id: string, status: number, log: string): CheckResult {
    return { id, status, log, command: 'npm', args: ['test'], cwd: '/repo', durationMs: 1 };
  }
}

test('independent review receives exact owner check results with edit freshness', () =>
  ReviewObservationsScenario.run());

test('protected architecture writes invalidate earlier owner-check freshness', () => {
  const check: CheckResult = {
    id: 'owner-tests',
    status: 0,
    log: 'before.log',
    command: 'npm',
    args: ['test'],
    cwd: '/repo',
    durationMs: 1,
  };
  const scope: StewardScope = { owner: 'execution', activity: 'testing' };
  const events = [
    { check, scope },
    { architectureWrite: { path: '.arc/architecture/operations/check.yaml' } },
  ];
  const observations = ownerReviewObservations(events, { tree: 'changed-tree', base: 'base' }, {});
  assert.equal(observations[0]?.afterLastEdit, false);
  assert.equal(observations[0]?.candidate, undefined);
});
