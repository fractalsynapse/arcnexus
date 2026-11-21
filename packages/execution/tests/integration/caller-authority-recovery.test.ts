import assert from 'node:assert/strict';
import test from 'node:test';
import { PreparedRecoveryFixture, criterion } from '../fixtures/prepared-recovery.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['recovery'] } as const;

test('caller continuity keeps host approvals exact and independent review bound to the recovered capture', async (t) => {
  const fixture = new PreparedRecoveryFixture(t);
  const reviewScopes: string[] = [];
  let approval: unknown;
  const proposal = 'exact-original-proposal';
  const question = 'Approve these exact protected bytes?';
  const candidate = { candidate: 'original-tree', ownerEvidenceDigest: 'original-owner-evidence' };
  fixture.afterActivation = async (task) => {
    const architect = task.capture.project.architect!;
    const reviewer = task.capture.project.verifier!;
    const review = { acceptance: [criterion], assignment: candidate };
    reviewScopes.push(task.inboxScope(reviewer, review));
    assert.notEqual(task.inboxScope(reviewer, review), task.inboxScope(reviewer, {
      ...review, assignment: { ...candidate, candidate: 'changed-tree' },
    }));
    assert.notEqual(task.inboxScope(reviewer, review), task.inboxScope(reviewer, {
      ...review, assignment: { ...candidate, ownerEvidenceDigest: 'changed-owner-evidence' },
    }));
    assert.notEqual(task.inboxScope(reviewer, review), task.inboxScope(reviewer, {
      ...review, acceptance: [{ ...criterion, description: 'Changed acceptance' }],
    }));
    if (reviewScopes.length === 1) {
      const ask = task.ask;
      task.ask = async () => 'approve';
      approval = await task.requestDecision(architect, proposal, question, new AbortController().signal);
      task.ask = ask;
      assert.deepEqual(task.decisionRecord(architect, proposal, question), approval);
      assert.equal(task.decisionRecord(architect, 'changed-proposal', question), undefined);
      assert.equal(task.decisionRecord(architect, proposal, 'Changed question?'), undefined);
    } else {
      assert.equal(task.decisionRecord(architect, proposal, question), undefined);
    }
  };
  assert.equal((await fixture.run()).kind, 'failed');
  fixture.advance();
  assert.equal((await fixture.run()).kind, 'merged');
  assert(approval);
  assert.equal(reviewScopes.length, 2);
  assert.notEqual(reviewScopes[0], reviewScopes[1], 'Earlier review must not follow caller continuity');
});
