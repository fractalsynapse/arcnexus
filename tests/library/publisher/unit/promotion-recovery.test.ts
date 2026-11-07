import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { PromotionRecovery } from '../../../../dist/library/publisher/publisher.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { workflowFixture } from '../../testing/support/workflow-fixture.js';

/** Exercises recovery against actual retained files, including conflicting later observations. */
class PromotionRecoveryScenario {
  /** Requires candidate-bound settled failures and never hides a later uncertain activation. */
  verify(t: TestContext): void {
    const fixture = workflowFixture(t);
    const run: any = {
      id: 'promotion',
      environment: { id: 'live', mode: 'live' },
      data: { promotionHead: 'head' },
    };
    const recovery = new PromotionRecovery(fixture.state);
    mkdirSync(join(fixture.state, 'runs'), { recursive: true });
    assert.throws(() => recovery.assertSettledFailure(run), /lacks settled failure/);
    this.write(fixture.state, 'first', run, 'failed');
    recovery.assertSettledFailure(run);
    for (const status of ['running', 'interrupted', 'cancelled', 'completed']) {
      this.write(fixture.state, 'second', run, status);
      assert.throws(() => recovery.assertSettledFailure(run), /lacks settled failure/);
    }
    this.write(fixture.state, 'second', run, 'failed');
    recovery.assertSettledFailure(run);
    this.write(fixture.state, 'second', { ...run, data: { promotionHead: 'foreign' } }, 'failed');
    assert.throws(() => recovery.assertSettledFailure(run), /lacks settled failure/);
  }

  /** Persists each attempt separately, preserving previous failure observations. */
  private write(root: string, id: string, run: any, status: string): void {
    const directory = join(root, 'runs', id);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, 'report.json'),
      JSON.stringify({
        id,
        executionRunId: run.id,
        executionEnvironment: run.environment,
        activationRole: 'publication-checks',
        base: run.data.promotionHead,
        status: 'failed',
        operationInvocations: [{ status }],
      }),
    );
  }
}

test('promotion recovery requires settled failure evidence for every target attempt', (t) =>
  new PromotionRecoveryScenario().verify(t));

registerSuite({ component: 'publisher', level: 'unit', tags: ['deterministic'] });
