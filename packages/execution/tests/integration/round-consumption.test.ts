import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { JournalEvent } from '../../../coordination/src/index.js';
import type { CompletedRefinementRound, TaskObserver } from '../../../workflow/src/index.js';
import { RoundConsumptionFixture } from '../fixtures/round-consumption.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

/** Retain complete native diagnostics in the assertion log before temporary storage is removed. */
function diagnostic(outcome: { evidence: readonly string[] }) {
  return JSON.stringify(outcome) + '\n' + outcome.evidence.filter((path) =>
    path.endsWith('codex.stderr.log')).map((path) => readFileSync(path, 'utf8')).join('\n');
}

const answer = 'Preserve accepted intent exactly.\nThe complete second line and final conclusion survive.';

interface Consumption {
  component: string;
  input: string;
  executable: string;
  reads: [string, string][];
  consumption: Array<CompletedRefinementRound & { reportText: string; findings: string[] }>;
}

/** Collect complete originating observations without altering sessions or manufacturing round events. */
class Observations implements TaskObserver {
  readonly events: JournalEvent[] = [];
  readonly rounds: CompletedRefinementRound[] = [];
  readonly consumers: Consumption[] = [];

  /** Return the same complete human answer through the normal durable clarification gate. */
  async answer() { return answer; }

  /** Accept ordinary phase progress while canonical frames remain the evidence source. */
  progress() {}

  /** Read the actual emitted provider record from its retained artifact. */
  event(event: JournalEvent) {
    this.events.push(event);
    const observation = event.observation as Record<string, any>;
    if (observation.completedRound) this.rounds.push(observation.completedRound);
    if (observation.nativeEvent?.event?.type === 'fixture.consumption') {
      const payload = JSON.parse(readFileSync(observation.nativeEvent.source, 'utf8'));
      this.consumers.push(payload.event ?? payload);
    }
  }
}

/** Require every real assessment to consume a completed round and cite exact source identities. */
function assertConsumption(observed: Observations, prior: CompletedRefinementRound) {
  for (const actor of ['planner', 'architecture', 'direction']) {
    const attempts = observed.consumers.filter(({ component }) => component === actor);
    assert.ok(attempts.length, 'real ' + actor + ' provider must run');
    for (const attempt of attempts) {
      const consumed = attempt.consumption.find(({ report }) => report === prior.report);
      assert.ok(consumed, actor + ' first prepared request omits the completed round report');
      assert.deepEqual(consumed.findings.length > 0, true, 'originating provider findings are read');
      assert.deepEqual(consumed.measurements, prior.measurements);
      assert.deepEqual(consumed.findings.length > 0, true);
      assert.ok(attempt.reads.some(([path]) => path === prior.report));
      assert.match(consumed.reportText, /Complete originating journal observations/);
      assert.match(consumed.reportText, /Event-derived measurements/);
      assert.match(JSON.stringify(consumed), /complete second line and final conclusion survive/);
      for (const sequence of prior.findings)
        assert.ok(consumed.reportText.includes('"sequence":"' + sequence + '"'));
    }
  }
}

test('EX-REF-ROUND-CONSUMPTION: real refinement feeds each next-round and fresh-invocation actor', async (t) => {
  const fixture = new RoundConsumptionFixture(t);
  const observed = new Observations();
  const outcome = await fixture.reopen().refine(fixture.root, 2, observed,
    new AbortController().signal);
  assert.equal(outcome.kind, 'planned', diagnostic(outcome));
  assert.equal(observed.rounds.length, 2, 'both rounds are produced by the public Workflow');
  const first = observed.rounds[0]!;
  const later = new Observations();
  later.consumers.push(...observed.consumers.filter(({ input }) => !first.findings.some(
    (sequence) => input.includes('"sequence":"' + sequence + '"'))));
  const fresh = new Observations();
  const next = await fixture.reopen().refine(fixture.root, 1, fresh,
    new AbortController().signal);
  assert.equal(next.kind, 'planned', JSON.stringify(next));
  assert.notEqual(fresh.rounds[0]!.invocation, first.invocation);
  assertConsumption(fresh, first);
  assertConsumption(secondRound(observed), first);
});

/** Select provider attempts by their actual journal position relative to the completed marker. */
function secondRound(observed: Observations) {
  const later = new Observations();
  const completion = observed.events.findIndex(({ observation }) =>
    Boolean((observation as Record<string, unknown>).completedRound));
  const sources = new Set(observed.events.slice(completion + 1).flatMap(({ observation }) => {
    const event = (observation as Record<string, any>).nativeEvent;
    return event?.event?.type === 'fixture.consumption' ? [event.source] : [];
  }));
  for (const path of sources) {
    const payload = JSON.parse(readFileSync(path, 'utf8'));
    later.consumers.push(payload.event ?? payload);
  }
  return later;
}

test('EX-REF-ROUND-RECOVERY: interrupted real assessment retains prior rounds and full answers on readmission', async (t) => {
  const fixture = new RoundConsumptionFixture(t);
  const original = new Observations();
  const controller = new AbortController();
  const event = original.event.bind(original);
  original.event = (frame) => {
    event(frame);
    const native = (frame.observation as Record<string, any>).nativeEvent;
    if (original.rounds.length === 1 && native?.event?.type === 'turn.completed')
      controller.abort();
  };
  const interrupted = await fixture.reopen().refine(fixture.root, 2, original, controller.signal);
  assert.equal(interrupted.kind, 'cancelled', diagnostic(interrupted));
  assert.equal(original.rounds.length, 1);
  const executable = fixture.install('newer-installed');
  const resumed = new Observations();
  const outcome = await fixture.reopen().refine(fixture.root, 2, resumed,
    new AbortController().signal);
  assert.equal(outcome.kind, 'planned', diagnostic(outcome));
  assert.equal(resumed.rounds.length, 1);
  assert.equal(resumed.rounds[0]!.invocation, original.rounds[0]!.invocation);
  assert.ok(resumed.consumers.every((consumer) => consumer.executable === executable));
  assertConsumption(resumed, original.rounds[0]!);
});
