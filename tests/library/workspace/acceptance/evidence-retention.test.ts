import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import { DeliveryStore } from '../../../../dist/library/coordination-store/delivery-store.js';
import {
  EvidenceRetention,
  WorkspaceResources,
} from '../../../../dist/library/workspace/workspace.js';
import { ExecutionReports } from '../../../../dist/library/report/report.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises real durable stores and filesystem expiration without invoking models or native sandboxes. */
class RetentionScenario {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-retention-'));

  readonly store = new ExecutionStore(join(this.root, 'projects', 'project', 'execution.sqlite'));

  /** Restores machine settings and removes only the test's disposable storage after each scenario. */
  constructor(t: TestContext, limit = '200000') {
    const previous = process.env.ARCNEXUS_EVIDENCE_MAX_BYTES;
    process.env.ARCNEXUS_EVIDENCE_MAX_BYTES = limit;
    t.after(() => {
      this.store.close();
      if (previous === undefined) delete process.env.ARCNEXUS_EVIDENCE_MAX_BYTES;
      else process.env.ARCNEXUS_EVIDENCE_MAX_BYTES = previous;
      rmSync(this.root, { recursive: true, force: true });
    });
  }

  /** Seeds retained evidence separately from source so expiration must preserve engineering material. */
  seed(status: 'completed' | 'running' = 'completed', bytes = 60000) {
    const run = this.store.createRun('task', ['owner'], 'Retained evidence');
    const id = randomUUID(),
      directory = join(this.root, 'runs', id);
    const workspace = join(this.root, 'workspaces', id);
    mkdirSync(directory, { recursive: true });
    mkdirSync(workspace, { recursive: true });
    writeFileSync(join(workspace, 'source.txt'), 'Keep source');
    const record = {
      id,
      executionRunId: run.id,
      status: 'completed',
      workspace,
      source: join(this.root, 'repository'),
      operationInvocations: [],
    };
    writeFileSync(join(directory, 'report.json'), JSON.stringify(record));
    writeFileSync(join(directory, 'operation.log'), 'x'.repeat(bytes));
    this.store.updateRun(run.id, status, { workspace: record });
    return { id, runId: run.id, directory, workspace, createdAt: run.createdAt };
  }

  /** Removes the oldest bundles to the low watermark and preserves source plus expiration receipts. */
  oldest(): void {
    const entries = [this.seed(), this.seed(), this.seed(), this.seed()].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
    const retention = new EvidenceRetention(this.root);
    retention.enforce();
    assert.ok(retention.bytes() <= 100000);
    for (const entry of entries.slice(0, 3)) {
      assert.equal(existsSync(entry.directory), false);
      assert.equal(
        JSON.parse(readFileSync(join(this.root, 'expired-evidence', entry.id + '.json'), 'utf8'))
          .status,
        'expired',
      );
      assert.ok(existsSync(join(entry.workspace, 'source.txt')));
      assert.throws(
        () => new WorkspaceResources(this.root).get(entry.id),
        /expired under retention/,
      );
      const view = new ExecutionReports(join(this.root, 'projects', 'project'), this.store).view(
        entry.runId,
      );
      assert.equal(view.run.data.evidenceRetention?.status, 'expired');
    }
    assert.ok(existsSync(entries[3]!.directory));
    retention.enforce();
    assert.ok(existsSync(entries[3]!.directory));
  }

  /** Protected evidence cannot be deleted just to satisfy a storage target. */
  protected(): void {
    const active = this.seed('running', 220000);
    assert.throws(() => new EvidenceRetention(this.root).enforce(), /protected/);
    assert.ok(existsSync(join(active.directory, 'operation.log')));
  }

  /** Active references pin an older terminal supplier even when its own lifecycle is complete. */
  referenced(): void {
    const old = this.seed('completed', 220000);
    const active = this.seed('running', 10);
    this.store.updateRun(active.runId, 'running', { candidateRecord: { id: old.id } });
    assert.throws(() => new EvidenceRetention(this.root).enforce(), /protected/);
    assert.ok(existsSync(old.directory));
  }

  /** Admission during active execution cannot expire evidence before the active checkpoint settles. */
  busy(): void {
    const entry = this.seed('completed', 220000);
    assert.throws(() => new EvidenceRetention(this.root).enforce(false), /checkpoint/);
    assert.ok(existsSync(entry.directory));
  }

  /** Terminal engineering cannot release evidence still required by a pending publication. */
  pendingDelivery(): void {
    const entry = this.seed('completed', 220000);
    const deliveries = new DeliveryStore(
      join(this.root, 'projects', 'project', 'deliveries.sqlite'),
    );
    try {
      deliveries.capture({
        id: 'delivery',
        projectId: 'project',
        packageId: 'package',
        runId: entry.runId,
        assignmentIds: ['assignment'],
        environment: { id: 'simulation', mode: 'simulation' },
        authorityDigest: 'authority',
        base: 'base',
        candidate: 'candidate',
        candidateRecordId: entry.id,
        verification: { digest: 'verified', references: ['observed'] },
        target: { repository: 'repository', branch: 'staging' },
      });
      assert.throws(() => new EvidenceRetention(this.root).enforce(), /protected/);
      assert.ok(existsSync(entry.directory));
    } finally {
      deliveries.close();
    }
  }

  /** A terminal run does not prove that an interrupted operation's evidence is disposable. */
  uncertain(): void {
    const entry = this.seed('completed', 220000);
    const path = join(entry.directory, 'report.json');
    const record = JSON.parse(readFileSync(path, 'utf8'));
    record.operationInvocations = [{ status: 'running' }];
    writeFileSync(path, JSON.stringify(record));
    assert.throws(() => new EvidenceRetention(this.root).enforce(), /protected/);
    assert.ok(existsSync(entry.directory));
  }

  /** An interrupted pruning cycle continues to half even after falling below its trigger threshold. */
  resume(): void {
    this.seed();
    this.seed();
    writeFileSync(
      join(this.root, 'evidence-retention.json'),
      JSON.stringify({ status: 'pruning' }),
    );
    const retention = new EvidenceRetention(this.root);
    retention.enforce();
    assert.ok(retention.bytes() <= 100000);
    assert.equal(
      JSON.parse(readFileSync(join(this.root, 'evidence-retention.json'), 'utf8')).status,
      'completed',
    );
  }
}

for (const name of [
  'oldest',
  'protected',
  'referenced',
  'busy',
  'resume',
  'pendingDelivery',
  'uncertain',
] as const)
  test('evidence retention: ' + name, (t) => new RetentionScenario(t)[name]());

test('evidence retention rejects invalid environment limits', (t) => {
  const scenario = new RetentionScenario(t, '-1');
  assert.throws(() => new EvidenceRetention(scenario.root), /ARCNEXUS_EVIDENCE_MAX_BYTES/);
});

registerSuite({
  component: 'workspace',
  level: 'acceptance',
  tags: ['deterministic', 'retention'],
});
