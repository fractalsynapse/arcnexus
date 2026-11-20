import assert from 'node:assert/strict';
import test from 'node:test';
import { Agent, type ActivationInput } from '../../../agent/src/index.js';
import { Architecture } from '../../../architecture/src/index.js';
import { AdoptionFixture } from '../fixtures/architecture-adoption.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

test('a later assessment receives complete findings and measurement references from a completed round', async (t) => {
  const fixture = new AdoptionFixture(t);
  const finding = 'The first round discovered an exact, complete guide finding.';
  const report = fixture.parent.store('round-report.md', finding);
  const measurement = fixture.parent.store('round-measurements.json', '{"tokens":123}');
  fixture.parent.note({
    refinementRound: { round: 1, status: 'completed', findings: [finding], report, measurement },
  });
  const agent = new Agent(new Architecture());
  let observed = '';
  t.mock.method(agent, 'activate', async ({ task }: ActivationInput) => {
    observed = JSON.stringify(task);
    return { kind: 'completed' };
  });

  await fixture.task.activate(
    agent,
    { component: 'service', activity: 'review' },
    { assignment: 'Assess the next round', acceptance: [], evidence: [] },
    new AbortController().signal,
  );

  assert.match(observed, /The first round discovered an exact, complete guide finding/);
  assert(observed.includes(report));
  assert(observed.includes(measurement));
});
