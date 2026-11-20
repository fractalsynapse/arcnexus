import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { JournalEvent } from '../../../coordination/src/index.js';
import { RoundConsumptionFixture } from '../../../execution/tests/fixtures/round-consumption.js';
import type { CompletedRefinementRound, TaskObserver } from '../../src/index.js';

export const suite = { owner: 'workflow', level: 'integration', tags: ['regression'] } as const;

interface Consumption {
  component: string;
  input: string;
  reads: string[];
  consumption: Array<CompletedRefinementRound & { sources: string[] }>;
  completed: number;
}

/** Collect actual completed rounds and prepared provider observations from the shared observer. */
class Observations implements TaskObserver {
  readonly rounds: CompletedRefinementRound[] = [];
  readonly consumers: Consumption[] = [];

  /** Supply a complete answer through the normal clarification gate. */
  async answer() {
    return 'Preserve accepted intent exactly.\nThe complete second line and final conclusion survive.';
  }

  /** The journal retains progress independently of the terminal observer. */
  progress() {}

  /** Associate each controlled provider observation with its real lifecycle position. */
  event(event: JournalEvent) {
    const observation = event.observation as Record<string, any>;
    if (observation.completedRound) this.rounds.push(observation.completedRound);
    if (observation.nativeEvent?.event?.type === 'fixture.consumption')
      this.consumers.push({
        ...(event.detail as { event: Consumption }).event,
        completed: this.rounds.length,
      });
  }
}

/** Require each actual actor request to advertise and read the exact completed report. */
function assertConsumption(observed: Observations, prior: CompletedRefinementRound, completed = 0) {
  for (const actor of ['planner', 'architecture', 'direction']) {
    const attempts = observed.consumers.filter(
      ({ component, completed: position }) => component === actor && position === completed,
    );
    assert.ok(attempts.length, actor + ' must be activated');
    for (const attempt of attempts) assertAttempt(attempt, prior);
  }
}

/** Check the prepared assignment and the complete sources actually read by this actor. */
function assertAttempt(attempt: Consumption, prior: CompletedRefinementRound) {
  const assignment = parse(
    attempt.input.split('\n\n## Activity')[0]!.slice(attempt.input.indexOf('\n\nassignment:') + 2),
  ).assignment;
  assert.ok(
    assignment.completedRounds.some(
      (round: CompletedRefinementRound) =>
        round.report === prior.report &&
        round.invocation === prior.invocation &&
        round.round === prior.round,
    ),
  );
  assert.ok(attempt.reads.includes(prior.report));
  const consumed = attempt.consumption.find(({ report }) => report === prior.report);
  assert.ok(consumed);
  assert.equal(consumed.invocation, prior.invocation);
  assert.equal(consumed.round, prior.round);
  assert.deepEqual(consumed.findings, prior.findings);
  assert.deepEqual(consumed.measurements, prior.measurements);
  assertSources(attempt, consumed, prior);
}

/** Verify the report and complete originating artifacts were read. */
function assertSources(
  attempt: Consumption,
  consumed: CompletedRefinementRound & { sources: string[] },
  prior: CompletedRefinementRound,
) {
  const sources = consumed.sources
    .map((source) => {
      assert.ok(attempt.reads.includes(source));
      return readFileSync(source, 'utf8');
    })
    .join('\n');
  for (const origin of ['planner finding ', 'architecture finding ', 'direction finding '])
    assert.ok(sources.includes(origin), 'the complete originating ' + origin + ' is readable');
  assert.ok(sources.includes('complete second line and final conclusion survive.'));
  const report = readFileSync(prior.report, 'utf8');
  for (const sequence of prior.findings)
    assert.ok(report.includes('"sequence":"' + sequence + '"'));
}

test('completed refinement reports reach real prepared assessments across invocations', async (t) => {
  const fixture = new RoundConsumptionFixture(t);
  const first = new Observations();
  const result = await fixture
    .reopen()
    .refine(fixture.root, '2', first, new AbortController().signal);
  assert.equal(result.kind, 'planned', JSON.stringify(result));
  assert.equal(first.rounds.length, 2);
  const prior = first.rounds[0]!;
  assert.ok(prior.findings.length);
  assert.ok(prior.measurements.length);
  assertConsumption(first, prior, 1);
  const next = new Observations();
  const resumed = await fixture
    .reopen()
    .refine(fixture.root, '1', next, new AbortController().signal);
  assert.equal(resumed.kind, 'planned', JSON.stringify(resumed));
  assert.notEqual(next.rounds[0]!.invocation, prior.invocation);
  assertConsumption(next, prior);
});
