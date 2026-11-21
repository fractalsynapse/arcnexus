import assert from 'node:assert/strict';
import test from 'node:test';
import { RecoveredAssessment } from '../../../verification/tests/fixtures/recovered-assessment.js';
import { integrate } from '../../src/index.js';

export const suite = { owner: 'delivery', level: 'integration', tags: ['regression'] } as const;

for (const field of ['tree', 'base', 'capture', 'acceptance', 'inputs'] as const) {
  test(
    'Delivery refuses an earlier verdict for recovered ' + field + ' before effects',
    async (t) => {
      const fixture = new RecoveredAssessment(t);
      const candidate = await fixture.assemble();
      const verdict = await fixture.run(candidate);
      assert(verdict.kind === 'accepted' && verdict.verification);
      const current = {
        ...candidate,
        verification: { ...verdict.verification, [field]: 'recovered-' + field },
      };
      const calls: string[] = [];
      t.mock.method(fixture.task, 'commit', () => {
        calls.push('commit');
        throw new Error('Stale acceptance reached candidate mutation');
      });
      t.mock.method(fixture.task, 'provider', () => {
        calls.push('provider');
        throw new Error('Stale acceptance reached provider');
      });
      await assert.rejects(
        integrate(fixture.task, current, verdict, new AbortController().signal),
        /accepting verdict|verification identity/i,
      );
      assert.deepEqual(
        calls,
        [],
        'A stale identity must be refused before committing or contacting GitHub',
      );
    },
  );
}

for (const change of ['base', 'capture', 'acceptance', 'required'] as const) {
  test(
    'Delivery rejects equal-tree historical approval after current ' + change + ' changes',
    async (t) => {
      const fixture = new RecoveredAssessment(t);
      const candidate = await fixture.assemble();
      const verdict = await fixture.run(candidate);
      assert(verdict.kind === 'accepted');
      if (change === 'acceptance') {
        const plan = structuredClone(fixture.plan);
        plan.milestones[0]!.criteria[0]!.description += ' with newly approved requirements';
        fixture.task.note({ plan });
      } else {
        const capture = fixture.advance(change);
        fixture.resume(change === 'capture' ? fixture.original : capture, capture);
      }
      const current = await fixture.assemble();
      assert.equal(current.digest, candidate.digest, 'The tree alone cannot establish eligibility');
      t.mock.method(fixture.task, 'commit', () => assert.fail('Stale approval reached commit'));
      t.mock.method(fixture.task, 'provider', () => assert.fail('Stale approval reached GitHub'));
      await assert.rejects(
        integrate(fixture.task, current, verdict, new AbortController().signal),
        /verification identity|accepting verdict/i,
      );
    },
  );
}
