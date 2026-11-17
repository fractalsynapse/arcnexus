import assert from 'node:assert/strict';
import test from 'node:test';
import type { Milestone, Plan, RevisionFeedback } from '../../../direction/src/index.js';
import type { TaskEvent } from '../../../workflow/src/index.js';
import { correctionFinding } from '../../src/correction.js';

const original: Milestone = { id: 'original', owner: 'execution', criteria: [], steps: [] };
const correction = { ...original, id: 'correction' };
const nested = { ...correction, id: 'nested' };
const focus = { purpose: 'Exercise correction evidence', objectives: [], constraints: [] };

test('a correction retains the exact finding from its own plan revision', () => {
  const plan: Plan = { focus, milestones: [original] };
  const first: RevisionFeedback = {
    kind: 'supplier',
    requester: original.id,
    owner: original.owner,
    milestone: original.id,
    reason: 'Format the specifically named test file',
    evidence: ['format.log'],
  };
  const second: RevisionFeedback = {
    ...first,
    requester: correction.id,
    milestone: correction.id,
    reason: 'Split the remaining oversized function',
    evidence: ['lint.log'],
  };
  const history: TaskEvent[] = [
    { plan },
    { feedback: first },
    { plan: { focus, milestones: [correction, original] } },
    { feedback: second },
    { plan: { focus, milestones: [nested, correction, original] } },
  ];
  assert.deepEqual(correctionFinding(history, correction), first);
  assert.deepEqual(correctionFinding(history, nested), second);
  assert.equal(correctionFinding(history, original), undefined);
  assert.equal(correctionFinding(history, { ...nested, owner: 'release' }), undefined);
});
