import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { HostTask } from '../../src/index.js';
import { PreparedRecoveryFixture, criterion } from '../fixtures/prepared-recovery.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['recovery'] } as const;

const proposal = 'exact-original-proposal';
const question = 'Approve these exact protected bytes?';
const candidate = { candidate: 'original-tree', ownerEvidenceDigest: 'original-owner-evidence' };

/** Observe host decisions and independent-review identity through real capture recovery. */
class CallerAuthorityScenario {
  private readonly fixture: PreparedRecoveryFixture;
  private readonly reviewScopes: string[] = [];
  private approval?: unknown;

  /** Bind characterization to the live prepared worktree before its normal cleanup. */
  constructor(context: TestContext) {
    this.fixture = new PreparedRecoveryFixture(context);
    this.fixture.afterActivation = async (task) => {
      this.observeReview(task);
      await this.observeApproval(task);
    };
  }

  /** Keep review scope sensitive to capture, candidate, owner evidence and accepted criteria. */
  private observeReview(task: HostTask) {
    const reviewer = task.capture.project.verifier!;
    const review = { acceptance: [criterion], assignment: candidate };
    const scope = task.inboxScope(reviewer, review);
    this.reviewScopes.push(scope);
    const changed = [
      { ...review, assignment: { ...candidate, candidate: 'changed-tree' } },
      { ...review, assignment: { ...candidate, ownerEvidenceDigest: 'changed-owner-evidence' } },
      { ...review, acceptance: [{ ...criterion, description: 'Changed acceptance' }] },
    ];
    for (const input of changed) assert.notEqual(scope, task.inboxScope(reviewer, input));
  }

  /** A controlled approve answer applies only to its original proposal, question and capture. */
  private async observeApproval(task: HostTask) {
    const architect = task.capture.project.architect!;
    if (this.reviewScopes.length !== 1) {
      assert.equal(task.decisionRecord(architect, proposal, question), undefined);
      return;
    }
    const ask = task.ask;
    task.ask = async () => 'approve';
    this.approval = await task.requestDecision(
      architect, proposal, question, new AbortController().signal,
    );
    task.ask = ask;
    assert.deepEqual(task.decisionRecord(architect, proposal, question), this.approval);
    assert.equal(task.decisionRecord(architect, 'changed-proposal', question), undefined);
    assert.equal(task.decisionRecord(architect, proposal, 'Changed question?'), undefined);
  }

  /** Recover the original task and reject reuse of its old review or host decision identity. */
  async run() {
    assert.equal((await this.fixture.run()).kind, 'failed');
    this.fixture.advance();
    assert.equal((await this.fixture.run()).kind, 'merged');
    assert(this.approval);
    assert.equal(this.reviewScopes.length, 2);
    assert.notEqual(this.reviewScopes[0], this.reviewScopes[1], 'Earlier review must not follow caller continuity');
  }
}

test('caller continuity keeps host approvals exact and independent review bound to the recovered capture', async (t) => {
  await new CallerAuthorityScenario(t).run();
});
