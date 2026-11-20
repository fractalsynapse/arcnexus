import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCitations } from '../../src/index.js';

export const suite = { owner: 'reviewer', level: 'unit', tags: ['regression'] } as const;

test('Reviewer citations resolve relative to the worktree and remain limited to retained evidence', () => {
  const verdict = {
    kind: 'accepted',
    candidate: 'candidate',
    criteria: ['scope'],
    evidence: ['../candidate.diff'],
  } as const;
  assert.deepEqual(
    validateCitations(verdict, '/state/run/worktree', ['/state/run/candidate.diff']),
    { ...verdict, evidence: ['/state/run/candidate.diff'] },
  );
  assert.throws(
    () => validateCitations(verdict, '/state/run/worktree', ['/elsewhere/candidate.diff']),
    /retained evidence/,
  );
});
