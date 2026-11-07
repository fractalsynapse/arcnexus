import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import {
  dependencySatisfied,
  type PreparedContribution,
} from '../../../../dist/library/coordination-store/execution-types.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises actual SQLite contribution transitions without assuming that prepared source is accepted. */
class ContributionFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'anx-contributions-'));

  readonly store = new ExecutionStore(join(this.root, 'execution.sqlite'));

  readonly run = this.store.createRun('task', ['implementation', 'tests', 'other'], 'One change');

  readonly implementation = this.store.enqueue(this.run.id, 'implementation', 'Implement');

  readonly tests = this.store.request(this.implementation.id, {
    key: 'regression',
    owner: 'tests',
    objective: 'Cover the behavior',
    acceptance: ['Real assertion'],
  });

  /** Retains the baseline pointer and cleans up the temporary database after each scenario. */
  constructor(t: TestContext) {
    this.store.updateRun(this.run.id, 'running', { candidateRevision: 'original' });
    t.after(() => {
      this.store.close();
      rmSync(this.root, { recursive: true, force: true });
    });
  }

  /** Supplies a controlled checkpoint receipt, preserving the distinction from verification evidence. */
  prepare(id: string) {
    const contribution = {
      recordId: randomUUID(),
      base: 'a'.repeat(40),
      revision: 'b'.repeat(40),
      checkpoint: 'c'.repeat(64),
    };
    this.store.updateAssignment(id, 'running', { recordId: contribution.recordId });
    this.store.prepareContribution(id, contribution);
    return contribution;
  }

  /** Reads the verified pointer independently of prepared source metadata. */
  candidate(): unknown {
    return this.store.run(this.run.id).data.candidateRevision;
  }
}

/** Checks atomic joint delivery, isolation of external dependencies and stale-checkpoint rejection. */
class ContributionScenarios {
  /** A test contribution unblocks implementation without claiming its promised verified milestone. */
  prepared(t: TestContext): void {
    const f = new ContributionFixture(t);
    f.prepare(f.tests.id);
    assert.throws(() => f.store.complete(f.tests.id, ['premature']), /assembled verification/);
    assert.equal(f.candidate(), 'original');
    assert.equal(f.store.assignment(f.tests.id).status, 'prepared');
    assert.equal(f.store.assignment(f.implementation.id).status, 'ready');
    assert.equal(dependencySatisfied(f.implementation, f.store.assignment(f.tests.id)), false);
    assert.deepEqual(
      f.store.ready(f.run.id).map((a) => a.id),
      [f.implementation.id],
    );
    assert.deepEqual(f.store.contributionGroups(f.run.id).ready(), []);
  }

  /** New director findings reopen only the selected unaccepted contribution without fabricating failure. */
  settled(t: TestContext): void {
    const f = new ContributionFixture(t);
    const contribution = f.prepare(f.tests.id);
    const implementation = f.prepare(f.implementation.id);
    f.store.updateAssignment(f.tests.id, 'prepared', {
      lastReceipt: 'prepared-receipt',
      lastFailedOutcome: { receipt: 'older-failure' },
    });
    const before = f.store.assignment(f.tests.id);
    const continuation = {
      assignmentId: f.tests.id,
      ownerId: 'tests',
      reason: 'Caller review observed a missing assertion before assembly',
    };
    f.store.admitDirection(f.run.id, [], [continuation], {});
    const after = f.store.assignment(f.tests.id);
    assert.equal(after.status, 'ready');
    assert.equal(after.objective, before.objective);
    assert.deepEqual(after.acceptance, before.acceptance);
    assert.deepEqual(after.data.contribution, contribution);
    assert.equal(after.data.lastReceipt, 'prepared-receipt');
    assert.equal(f.store.assignment(f.implementation.id).status, 'prepared');
    this.rejectsStalePrepared(f, implementation, contribution);
  }

  /** Earlier assembled acceptance cannot promote source whose contribution was reopened. */
  private rejectsStalePrepared(
    f: ContributionFixture,
    implementation: PreparedContribution,
    contribution: PreparedContribution,
  ): void {
    assert.throws(
      () =>
        f.store.completeAssembly(
          [f.implementation.id, f.tests.id],
          ['stale review'],
          { candidateRevision: 'assembled', assemblyBase: 'original' },
          [implementation, contribution],
        ),
      /changed after verification/,
    );
    assert.equal(f.candidate(), 'original');
  }

  /** Correlated feedback reopens only its prepared supplier and preserves accepted scope on retries. */
  feedback(t: TestContext): void {
    const f = new ContributionFixture(t);
    f.prepare(f.tests.id);
    const request = f.store
      .inbox(f.implementation.id)
      .find((item) => item.from === f.implementation.id)!;
    const action = {
      requestId: request.id,
      action: 'feedback' as const,
      text: 'Preserve the exact public field shape',
    };
    const before = f.store.assignment(f.tests.id);
    f.store.respond(f.implementation.id, [action]);
    assert.equal(f.store.assignment(f.tests.id).status, 'ready');
    assert.deepEqual(f.store.assignment(f.tests.id).acceptance, before.acceptance);
    assert.equal(f.store.assignment(f.tests.id).objective, before.objective);
    f.prepare(f.tests.id);
    f.store.respond(f.implementation.id, [action]);
    assert.equal(f.store.assignment(f.tests.id).status, 'prepared');
    assert.equal(f.candidate(), 'original');
  }

  /** Related contributions publish together and exact repeated completion changes no candidate. */
  complete(t: TestContext): void {
    const f = new ContributionFixture(t);
    const test = f.prepare(f.tests.id);
    const implementation = f.prepare(f.implementation.id);
    const ids = [f.implementation.id, f.tests.id];
    const evidence = ['independent combined acceptance'];
    const candidate = { candidateRevision: 'assembled', assemblyBase: 'original' };
    assert.equal(f.store.contributionGroups(f.run.id).ready().length, 1);
    f.store.completeAssembly(ids, evidence, candidate, [implementation, test]);
    f.store.completeAssembly(ids, evidence, candidate, [implementation, test]);
    assert.ok(ids.every((id) => f.store.assignment(id).status === 'completed'));
    assert.equal(f.candidate(), 'assembled');
    assert.throws(() => f.store.completeAssembly(ids, ['different'], candidate, []), /Duplicate/);
  }

  /** Incomplete and stale contribution sets fail before any assignment or pointer is updated. */
  rejects(t: TestContext): void {
    const f = new ContributionFixture(t);
    const test = f.prepare(f.tests.id);
    const implementation = f.prepare(f.implementation.id);
    const candidate = { candidateRevision: 'assembled', assemblyBase: 'original' };
    assert.throws(
      () => f.store.completeAssembly([f.tests.id], ['proof'], candidate, [test]),
      /complete related/,
    );
    assert.throws(
      () =>
        f.store.completeAssembly([f.implementation.id, f.tests.id], ['proof'], candidate, [
          implementation,
          { ...test, checkpoint: 'd'.repeat(64) },
        ]),
      /changed after verification/,
    );
    assert.equal(f.candidate(), 'original');
    assert.equal(f.store.assignment(f.implementation.id).status, 'prepared');
    assert.equal(f.store.assignment(f.tests.id).status, 'prepared');
  }

  /** A newer verified delivery invalidates assembly acceptance without discarding prepared edits. */
  baseline(t: TestContext): void {
    const f = new ContributionFixture(t);
    const test = f.prepare(f.tests.id);
    const implementation = f.prepare(f.implementation.id);
    f.store.updateRun(f.run.id, 'running', { candidateRevision: 'newer' });
    assert.throws(
      () =>
        f.store.completeAssembly(
          [f.implementation.id, f.tests.id],
          ['proof'],
          { candidateRevision: 'assembled', assemblyBase: 'original' },
          [implementation, test],
        ),
      /baseline changed/,
    );
    assert.equal(f.candidate(), 'newer');
    assert.equal(f.store.assignment(f.tests.id).status, 'prepared');
    assert.equal(f.store.assignment(f.implementation.id).status, 'prepared');
  }

  /** Nested fan-out and fan-in derive one group without imposing an owner or participant count. */
  nested(t: TestContext): void {
    const f = new ContributionFixture(t);
    const extra = f.store.enqueue(f.run.id, 'other', 'Related source');
    const second = f.store.enqueue(f.run.id, 'tests', 'Another contribution');
    const final = f.store.enqueue(f.run.id, 'other', 'Shared nested contribution');
    f.store.link(f.implementation.id, extra.id);
    f.store.link(f.tests.id, second.id);
    f.store.link(extra.id, final.id);
    f.store.link(second.id, final.id);
    const ids = [f.implementation.id, f.tests.id, extra.id, second.id, final.id];
    const prepared = ids.map((id) => f.prepare(id));
    const groups = f.store.contributionGroups(f.run.id).ready();
    assert.equal(groups.length, 1);
    assert.equal(groups[0]!.length, 5);
    f.store.completeAssembly(
      ids,
      ['combined proof'],
      {
        candidateRevision: 'combined',
        assemblyBase: 'original',
      },
      prepared,
    );
    assert.ok(ids.every((id) => f.store.assignment(id).status === 'completed'));
  }

  /** Research dependencies remain external verification obligations and unrelated work keeps running. */
  external(t: TestContext): void {
    const f = new ContributionFixture(t);
    const research = f.store.request(f.tests.id, {
      key: 'research',
      owner: 'other',
      kind: 'research',
      objective: 'Resolve uncertainty',
      acceptance: ['Evidence'],
    });
    f.prepare(f.tests.id);
    f.prepare(f.implementation.id);
    const unrelated = f.store.enqueue(f.run.id, 'other', 'Unrelated improvement');
    assert.deepEqual(f.store.contributionGroups(f.run.id).ready(), []);
    assert.ok(f.store.ready(f.run.id).some((a) => a.id === unrelated.id));
    f.store.complete(research.id, ['verified research']);
    assert.equal(f.store.contributionGroups(f.run.id).ready().length, 1);
  }
}

const scenarios = new ContributionScenarios();

test('prepared dependency unblocks engineering but never claims delivery', (t) =>
  scenarios.prepared(t));

test('assembled completion is atomic and repeated delivery is idempotent', (t) =>
  scenarios.complete(t));

test('partial or stale assemblies preserve all unverified contributions', (t) =>
  scenarios.rejects(t));

test('new candidate invalidates stale assembly verification without losing contributions', (t) =>
  scenarios.baseline(t));

test('five nested contributions with shared owners form one atomic delivery', (t) =>
  scenarios.nested(t));

test('external obligations block assembly without starving unrelated work', (t) =>
  scenarios.external(t));

test('director feedback reopens prepared work while preserving peers and invalidating stale acceptance', (t) =>
  scenarios.settled(t));

test('existing request feedback preserves scope and does not replay on retry', (t) =>
  scenarios.feedback(t));

registerSuite({
  component: 'coordination-store',
  level: 'integration',
  tags: ['deterministic', 'delivery'],
});
