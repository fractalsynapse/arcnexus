import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { DeliveryChecks } from '../../../../dist/library/publisher/publisher.js';
import { save, type RecordData } from '../../../../dist/library/workspace/state.js';
import { ExecutionControls } from '../../../../dist/library/execution-runtime/execution-controls.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { PromotionFixture } from '../support/promotion-fixture.js';

/** Qualifies promotion's real host/checkpoint/check wiring with explicitly controlled model and provider inputs. */
class PromotionScenarios {
  /** Missing host credentials cannot create live work; a corrected binding admits one durable task. */
  missingCredential(t: TestContext): void {
    const f = new PromotionFixture(t);
    for (const name of ['GH_TOKEN', 'GITHUB_TOKEN']) {
      const previous = process.env[name];
      delete process.env[name];
      t.after(() => {
        if (previous === undefined) delete process.env[name];
        else process.env[name] = previous;
      });
    }
    assert.throws(() => f.host.promote(f.delivery.id), /Configure GH_TOKEN or GITHUB_TOKEN/);
    assert.equal(f.host.store.runs().length, 1);
    process.env.GH_TOKEN = 'controlled-test-credential';
    const queued = f.host.promote(f.delivery.id);
    delete process.env.GH_TOKEN;
    assert.deepEqual(f.host.promote(f.delivery.id), queued);
    assert.equal(f.host.store.runs().length, 2);
  }

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

  /** Reads exactly the artifacts advertised to the independent reviewer and compares them to host output. */
  private assertPublicationEvidence(check: any, reviewer: any): void {
    const manifest = reviewer.verificationEvidence;
    const content = (id: string) => this.artifact(manifest, id);
    const execution = JSON.parse(content('execution'));
    assert.equal(execution.publication.head, check.base);
    assert.equal(execution.publication.recordId, check.id);
    const commands = execution.publication.observations.hostCommands;
    assert.ok(commands.length > 0);
    for (const command of commands)
      assert.equal(
        content(command.output.artifact),
        readFileSync(check.commands[command.index].log, 'utf8'),
      );
    assert.equal(execution.publication.sourceDeliveries.length, 1);
    assert.equal(reviewer.activationRole, 'verifier');
    assert.equal(reviewer.acceptanceCriteria[0], 'Preserve the reviewed source improvement');
  }

  /** Resolves advertised nested indexes without assuming every historical artifact is in the root manifest. */
  private artifact(manifest: any, id: string): string {
    const artifacts = [...manifest.artifacts];
    for (const index of manifest.artifacts.filter((entry: any) =>
      entry.id.startsWith('artifact-index:'),
    ))
      artifacts.push(...JSON.parse(readFileSync(join(manifest.directory, index.sha256), 'utf8')));
    const artifact = artifacts.find((entry: any) => entry.id === id);
    assert.ok(artifact, 'Missing review artifact: ' + id);
    return readFileSync(join(manifest.directory, artifact.sha256), 'utf8');
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
      ['publication-checks', 'verifier'],
    );
    for (const review of reports.slice(1)) this.assertPublicationEvidence(reports[0], review);
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

  /** A settled failed target check resumes the retained assembly without duplicating its issue. */
  async failedRetry(t: TestContext): Promise<void> {
    const f = new PromotionFixture(t);
    const calls = f.tracking(t);
    const queued = f.host.promote(f.delivery.id);
    await f.host.tick();
    const head = f.host.store.run(queued.runId).data.promotionHead;
    const checks = t.mock.method(
      DeliveryChecks.prototype,
      'checkRecord',
      async (record: RecordData) => this.failure(f, record),
    );
    await f.host.tick();
    assert.equal(f.host.store.run(queued.runId).status, 'needs_attention');
    assert.match(String(f.host.store.run(queued.runId).data.error), /settled dependency failure/);
    checks.mock.restore();
    f.host.taskControl('resume', queued.runId);
    assert.equal(f.host.store.run(queued.runId).data.promotionStage, 'assembled');
    await f.host.tick();
    assert.equal(f.host.store.run(queued.runId).data.promotionStage, 'verified');
    assert.equal(f.host.store.run(queued.runId).data.promotionHead, head);
    assert.equal(calls.length, 1);
    assert.equal(f.host.store.runs().length, 2);
  }

  /** Supplies one explicit external-failure observation at the verification boundary. */
  private failure(f: PromotionFixture, record: RecordData) {
    record.status = 'failed';
    record.error = 'Controlled settled dependency failure';
    record.operationInvocations = [{ status: 'failed' }];
    save(f.general.fixture.state, record);
    const path = join(f.general.fixture.state, 'runs', record.id, 'report.json');
    return { status: 'failed' as const, evidence: [path], artifacts: [] };
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
    f.credential(t);
    const queued = f.host.promote(f.delivery.id);
    f.host.store.updateRun(queued.runId, 'interrupted', { promotionStage: 'verifying' });
    assert.throws(() => f.host.taskControl('resume', queued.runId), /verification was interrupted/);
    assert.equal(f.host.store.run(queued.runId).status, 'needs_attention');
    assert.equal(f.deliveries.list().length, 1);
  }
}

const scenarios = new PromotionScenarios();

test('promotion validates host credentials before durable admission', (t) =>
  scenarios.missingCredential(t));

test('promotion uses fresh target checks and independent reviews without relabeling simulation', (t) =>
  scenarios.verified(t));

test('settled promotion failure resumes without recreating tracking or assembly', (t) =>
  scenarios.failedRetry(t));

test('promotion rejects altered source before creating live work', (t) => scenarios.rejected(t));

test('interrupted promotion verification cannot silently replay', (t) => scenarios.interrupted(t));

test('promotion uses the provider staging commit even when checkout HEAD grants publication', (t) =>
  scenarios.stagingAuthority(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'promotion'],
});
