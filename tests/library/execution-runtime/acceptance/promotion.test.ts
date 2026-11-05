import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionControls } from '../../../../dist/library/execution-runtime/execution-controls.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { PromotionFixture } from '../support/promotion-fixture.js';

/** Qualifies promotion's real host/checkpoint/check wiring with explicitly controlled model and provider inputs. */
class PromotionScenarios {
  /** A checkout-only grant cannot authorize promotion when the actual upstream staging revision lacks it. */
  async stagingAuthority(t: TestContext): Promise<void> {
    const f = new PromotionFixture(t);
    const { state, repo } = f.general.fixture;
    const directory = join(state, 'projects', f.context.key);
    writeFileSync(join(directory, 'host.json'), JSON.stringify({ contextFile: 'context.json' }));
    writeFileSync(
      join(directory, 'context.json'),
      JSON.stringify({ source: repo, key: f.context.key }),
    );
    const base = execFileSync('git', ['rev-parse', 'HEAD^'], {
      cwd: repo,
      encoding: 'utf8',
    }).trim();
    f.credential(t);
    const query = t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
      assert.equal(
        url,
        'https://api.github.com/repos/example/promotion-fixture/git/ref/heads/staging',
      );
      assert.equal(options.method, 'GET');
      return Response.json({ ref: 'refs/heads/staging', object: { type: 'commit', sha: base } });
    });
    await assert.rejects(
      new ExecutionControls(state).promote(f.delivery.id),
      /publication grant on.*staging/,
    );
    assert.equal(query.mock.callCount(), 1);
    assert.equal(f.host.store.runs().length, 1);
  }

  /** Preserves simulation evidence, checks current target bytes and runs both independent target assessments. */
  async verified(t: TestContext): Promise<void> {
    const f = new PromotionFixture(t);
    const calls = f.tracking(t);
    const original = JSON.stringify(f.deliveries.get(f.delivery.id));
    const queued = f.host.promote(f.delivery.id);
    assert.notEqual(queued.runId, f.source.id);
    assert.deepEqual(f.host.promote(f.delivery.id), queued);
    await f.host.tick();
    const assembled = f.host.store.run(queued.runId);
    assert.equal(assembled.data.promotionStage, 'assembled');
    assert.equal(calls.length, 1);
    f.host.taskControl('pause', queued.runId);
    f.host.taskControl('resume', queued.runId);
    assert.equal(f.host.store.run(queued.runId).data.promotionHead, assembled.data.promotionHead);
    await f.host.tick();
    const run = f.host.store.run(queued.runId);
    assert.equal(run.data.promotionStage, 'verified', String(run.data.error ?? run.status));
    this.assertDelivery(f, queued.runId);
    assert.equal(JSON.stringify(f.deliveries.get(f.delivery.id)), original);
    f.host.taskControl('pause', queued.runId);
    await f.host.tick();
    assert.equal(f.host.store.run(queued.runId).status, 'paused');
    assert.equal(calls.length, 1);
    assert.equal(readFileSync(join(f.general.fixture.repo, 'source.txt'), 'utf8'), 'before');
  }

  /** Checks fresh current-run review identities and retains original assignments without fabricating live completions. */
  private assertDelivery(f: PromotionFixture, id: string): void {
    const run = f.host.store.run(id);
    const delivery = f.deliveries.get(String(run.data.deliveryId));
    assert.equal(delivery.promotedFrom, f.delivery.id);
    assert.equal(delivery.environment.mode, 'live');
    assert.notEqual(delivery.environment.id, f.delivery.environment.id);
    assert.deepEqual(delivery.assignmentIds, f.delivery.assignmentIds);
    assert.deepEqual(f.host.store.assignments(id), []);
    const reports = delivery.verification.references.map((path) =>
      JSON.parse(readFileSync(path, 'utf8')),
    );
    assert.ok(
      reports.every((report) => report.executionRunId === id && report.status === 'completed'),
    );
    assert.deepEqual(
      reports.map((r) => r.activationRole),
      ['publication-checks', 'verifier', 'director-assessment'],
    );
    assert.equal(reports[2].acceptanceCriteria.length, 2);
    assert.equal(delivery.approval, undefined);
    assert.equal(delivery.integration, 'not_requested');
    assert.equal(delivery.publication, 'not_requested');
    assert.equal(run.data.pendingPublication, delivery.id);
    assert.deepEqual(run.data.goalEvidence, [delivery.verification.references.at(-1)]);
    assert.equal(run.data.goalCandidate, delivery.candidate);
    assert.equal(
      f.host.store.latestDelivery(f.context.base, f.context.packageId, run.environment)?.id,
      id,
    );
  }

  /** Invalid source proof cannot create a live run or upstream effect. */
  rejected(t: TestContext): void {
    const f = new PromotionFixture(t);
    writeFileSync(join(f.record.workspace, 'source.txt'), 'unreviewed replacement');
    assert.throws(() => f.host.promote(f.delivery.id), /changed after verified/);
    assert.equal(f.host.store.runs().length, 1);
    assert.equal(f.deliveries.list().length, 1);
  }

  /** An interrupted verification checkpoint cannot replay commands or infer acceptance from partial evidence. */
  interrupted(t: TestContext): void {
    const f = new PromotionFixture(t);
    const queued = f.host.promote(f.delivery.id);
    f.host.store.updateRun(queued.runId, 'interrupted', { promotionStage: 'verifying' });
    assert.throws(() => f.host.taskControl('resume', queued.runId), /verification was interrupted/);
    assert.equal(f.host.store.run(queued.runId).status, 'needs_attention');
    assert.equal(f.deliveries.list().length, 1);
  }
}

const scenarios = new PromotionScenarios();

test('promotion uses fresh target checks and independent reviews without relabeling simulation', (t) =>
  scenarios.verified(t));

test('promotion rejects altered source before creating live work', (t) => scenarios.rejected(t));

test('interrupted promotion verification cannot silently replay', (t) => scenarios.interrupted(t));

test('promotion uses the provider staging commit even when checkout HEAD grants publication', (t) =>
  scenarios.stagingAuthority(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'promotion'],
});
