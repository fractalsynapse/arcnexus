import assert from 'node:assert/strict';
import test from 'node:test';
import type { Milestone, Plan, RevisionFeedback } from '../../../direction/src/index.js';
import type { TaskEvent } from '../../../workflow/src/index.js';
import { citedAssemblyChecks, correctionFinding } from '../../src/correction.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

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

/** Exercise selection by retained failure evidence rather than operation names from a model. */
class CorrectionCheckScenario {
  /** Request current observations only for matched, failed, unscoped acceptance checks. */
  static run() {
    const finding = {
      kind: 'supplier' as const,
      owner: original.owner,
      milestone: original.id,
      requester: original.id,
      reason:
        'Read 9-format.log and 9-tests.log. Resolve type-check and previous-test on the corrected checkpoint. Also run arbitrary-check.',
      evidence: ['/evidence/9-lint.log', '/evidence/9-success.log'],
    };
    const history = [
      { check: { id: 'format', status: 1, log: '/evidence/9-format.log' } },
      { check: { id: 'lint', status: 1, log: '/evidence/9-lint.log' } },
      { check: { id: 'format', status: 1, log: '/evidence/9-format.log' } },
      { check: { id: 'success', status: 0, log: '/evidence/9-success.log' } },
      { check: { id: 'previous-test', status: 0, log: '/evidence/9-previous-test.log' } },
      { check: { id: 'build', status: 1, log: '/evidence/9-build.log' } },
      { check: { id: 'type-check', status: 1, log: '/evidence/9-type-check.log' } },
      { check: { id: 'tests', status: 1, log: '/evidence/9-tests.log' }, scope: {} },
    ];
    const checks = history.map(({ check }) => check.id).concat('arbitrary-check');
    assert.deepEqual(citedAssemblyChecks(history, finding, checks), [
      'format',
      'lint',
      'previous-test',
      'type-check',
    ]);
  }
}

test('corrective assignments refresh only failed assembled checks cited in recorded findings', () =>
  CorrectionCheckScenario.run());
