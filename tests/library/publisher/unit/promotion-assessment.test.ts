import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { candidateDigest } from '../../../../dist/library/change-inspection/changes.js';
import { PromotionReview } from '../../../../dist/library/publisher/promotion-review.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { workflowFixture } from '../../testing/support/workflow-fixture.js';

/** Ensures untrusted or stale assessment pointers cannot authorize promotion. */
class PromotionAssessmentScenario {
  /** Invalid completion, run, environment and candidate identities fail before goal review. */
  rejects(t: TestContext, field: string, value: unknown): void {
    const fixture = workflowFixture(t);
    const record: any = { id: 'check', workspace: fixture.repo, base: 'HEAD' };
    const run: any = { id: 'live', environment: { id: 'target', mode: 'live' } };
    const review: any = {
      id: 'review',
      executionRunId: 'live',
      parentRecordId: 'check',
      executionEnvironment: run.environment,
      activationRole: 'verifier',
      status: 'completed',
      agent: { status: 'completed' },
      verificationEvidence: { candidateDigest: candidateDigest(record) },
    };
    review[field] = value;
    const path = join(fixture.root, 'assessment.json');
    writeFileSync(path, JSON.stringify(review));
    const promotion: any = new PromotionReview(fixture.state, {} as any, {} as any, run, []);
    assert.throws(
      () => promotion.assessments(record, { evidence: ['check-report', path] }),
      /assessment identity or candidate does not match/,
    );
  }
}

const scenario = new PromotionAssessmentScenario();

for (const [field, value] of Object.entries({
  executionRunId: 'foreign',
  parentRecordId: 'other',
  executionEnvironment: { id: 'foreign' },
  activationRole: 'worker',
  status: 'failed',
  agent: { status: 'blocked' },
  verificationEvidence: { candidateDigest: 'different-candidate' },
})) {
  test('promotion refuses invalid target assessment ' + field, (t) =>
    scenario.rejects(t, field, value),
  );
}

registerSuite({ component: 'publisher', level: 'unit', tags: ['deterministic', 'promotion'] });
