import assert from 'node:assert/strict';
import test from 'node:test';
import { RecoveredAssessment } from '../../../verification/tests/fixtures/recovered-assessment.js';
import { integrate } from '../../src/index.js';

export const suite = { owner: 'delivery', level: 'integration', tags: ['regression'] } as const;

for (const field of ['tree', 'base', 'capture', 'acceptance', 'inputs'] as const) {
  test('Delivery refuses an earlier verdict for recovered ' + field + ' before effects', async (t) => {
    const fixture = new RecoveredAssessment(t);
    const candidate = await fixture.assemble();
    const verdict = await fixture.run(candidate);
    assert(verdict.kind === 'accepted' && verdict.verification);
    const current = { ...candidate, verification: { ...verdict.verification, [field]: 'recovered-' + field } };
    const calls: string[] = [];
    t.mock.method(fixture.task, 'commit', () => {
      calls.push('commit');
      throw new Error('Stale acceptance reached candidate mutation');
    });
    t.mock.method(fixture.task, 'provider', () => {
      calls.push('provider');
      throw new Error('Stale acceptance reached provider');
    });
    await assert.rejects(integrate(fixture.task, current, verdict, new AbortController().signal), /accepting verdict|verification identity/i);
    assert.deepEqual(calls, [], 'A stale identity must be refused before committing or contacting GitHub');
  });
}
