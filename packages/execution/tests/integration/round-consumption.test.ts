import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';
import type { JournalEvent } from '../../../coordination/src/index.js';
import type { CompletedRefinementRound, TaskObserver } from '../../../workflow/src/index.js';
import { RoundConsumptionFixture } from '../fixtures/round-consumption.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

/** Retain complete native diagnostics in the assertion log before temporary storage is removed. */
function diagnostic(outcome: { evidence: readonly string[] }) {
  return (
    JSON.stringify(outcome) +
    '\n' +
    outcome.evidence
      .filter((path) => path.endsWith('codex.stderr.log'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')
  );
}

const answer =
  'Preserve accepted intent exactly.\nThe complete second line and final conclusion survive.';

interface Consumption {
  component: string;
  input: string;
  executable: string;
  reads: string[];
  consumption: Array<
    CompletedRefinementRound & {
      sources: string[];
      messages: Array<{ path: string; sha256: string }>;
    }
  >;
}

/** Collect complete originating observations without altering sessions or manufacturing round events. */
class Observations implements TaskObserver {
  readonly events: JournalEvent[] = [];
  readonly rounds: CompletedRefinementRound[] = [];
  readonly consumers: Consumption[] = [];

  /** Return the same complete human answer through the normal durable clarification gate. */
  async answer() {
    return answer;
  }

  /** Accept ordinary phase progress while canonical frames remain the evidence source. */
  progress() {}

  /** Read the actual emitted provider record from its retained artifact. */
  event(event: JournalEvent) {
    this.events.push(event);
    const observation = event.observation as Record<string, any>;
    if (observation.completedRound) this.rounds.push(observation.completedRound);
    if (observation.nativeEvent?.event?.type === 'fixture.consumption') {
      this.consumers.push((event.detail as { event: Consumption }).event);
    }
  }
}

/** Inspect all actor attempts so an early Planner failure cannot conceal other missing consumers. */
function consumptionGaps(observed: Observations, prior: CompletedRefinementRound) {
  const missing: string[] = [];
  for (const actor of ['planner', 'architecture', 'direction']) {
    const attempts = observed.consumers.filter(({ component }) => component === actor);
    assert.ok(attempts.length, 'real ' + actor + ' provider must run');
    for (const [index, attempt] of attempts.entries()) {
      const consumed = attempt.consumption.find(({ report }) => report === prior.report);
      const task = parse(
        attempt.input
          .split('\n\n## Activity')[0]!
          .slice(attempt.input.indexOf('\n\nassignment:') + 2),
      );
      const advertised = task.assignment.completedRounds?.some(
        (round: CompletedRefinementRound) => round.report === prior.report,
      );
      if (!consumed || !advertised) {
        missing.push(actor + ' attempt ' + index + ' omits completed round ' + prior.round);
        continue;
      }
      assertOrigins(attempt, consumed, prior);
    }
  }
  return missing;
}

/** Require complete mapped reads, exact event references and distinct source findings. */
function assertOrigins(
  attempt: Consumption,
  consumed: Consumption['consumption'][number],
  prior: CompletedRefinementRound,
) {
  assert.deepEqual(consumed.measurements, prior.measurements);
  assert.deepEqual(consumed.findings, prior.findings);
  assert.ok(prior.measurements.length, 'the real producer records provider measurement references');
  assert.ok(attempt.reads.includes(prior.report));
  const report = readFileSync(prior.report, 'utf8');
  assert.match(report, /Event-derived measurements/);
  const messages = originatingMessages(attempt, consumed);
  for (const actor of ['planner', 'architecture', 'direction'])
    assert.ok(messages.some((finding) => finding.includes(actor + ' finding ')));
  assert.ok(messages.some((finding) => finding.includes(JSON.stringify(answer).slice(1, -1))));
  for (const sequence of prior.findings)
    assert.ok(report.includes('"sequence":"' + sequence + '"'));
}

/** Resolve cited message identities against complete originating artifacts read by the provider. */
function originatingMessages(attempt: Consumption, consumed: Consumption['consumption'][number]) {
  for (const source of consumed.sources) assert.ok(attempt.reads.includes(source));
  return consumed.messages.map(({ path, sha256 }) => {
    assert.ok(consumed.sources.includes(path));
    const records = readFileSync(path, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const message = records.find(
      (record) =>
        record.item?.type === 'agent_message' &&
        createHash('sha256').update(record.item.text).digest('hex') === sha256,
    );
    assert.ok(message, 'the consumed identity resolves to the complete originating message');
    const reply = JSON.parse(message.item.text);
    return typeof reply.summary === 'string' ? reply.summary : '';
  });
}

test('EX-REF-ROUND-CONSUMPTION: real refinement feeds each next-round and fresh-invocation actor', async (t) => {
  const fixture = new RoundConsumptionFixture(t);
  const observed = new Observations();
  const outcome = await fixture
    .reopen()
    .refine(fixture.root, '2', observed, new AbortController().signal);
  assert.equal(outcome.kind, 'planned', diagnostic(outcome));
  assert.equal(observed.rounds.length, 2, 'both rounds are produced by the public Workflow');
  const first = observed.rounds[0]!;
  const fresh = new Observations();
  const next = await fixture.reopen().refine(fixture.root, '1', fresh, new AbortController().signal);
  assert.equal(next.kind, 'planned', JSON.stringify(next));
  assert.notEqual(fresh.rounds[0]!.invocation, first.invocation);
  assert.deepEqual(
    {
      nextRound: consumptionGaps(secondRound(observed), first),
      freshInvocation: consumptionGaps(fresh, first),
    },
    { nextRound: [], freshInvocation: [] },
    'all prepared assessments must consume prior rounds',
  );
});

/** Select provider attempts by their actual journal position relative to the completed marker. */
function secondRound(observed: Observations) {
  const later = new Observations();
  const completion = observed.events.findIndex(({ observation }) =>
    Boolean((observation as Record<string, unknown>).completedRound),
  );
  for (const frame of observed.events.slice(completion + 1)) {
    const detail = frame.detail as { event?: Consumption & { type?: string } } | undefined;
    if (detail?.event?.type === 'fixture.consumption') later.consumers.push(detail.event);
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
  const interrupted = await fixture.reopen().refine(fixture.root, '2', original, controller.signal);
  assert.equal(interrupted.kind, 'cancelled', diagnostic(interrupted));
  assert.equal(original.rounds.length, 1);
  const executable = fixture.install('replacement-v2');
  const resumed = new Observations();
  const outcome = await fixture
    .reopen()
    .refine(fixture.root, 2, resumed, new AbortController().signal);
  assert.equal(outcome.kind, 'planned', diagnostic(outcome));
  assert.equal(resumed.rounds.length, 1);
  assert.equal(resumed.rounds[0]!.invocation, original.rounds[0]!.invocation);
  assert.ok(resumed.consumers.every((consumer) => consumer.executable === executable));
  assertRecovery(original, resumed, fixture);
  assert.deepEqual(
    consumptionGaps(resumed, original.rounds[0]!),
    [],
    'resumed assessments must consume the original completed round',
  );
});

/** Keep historical identity and the durable answer while admitting the replacement executable. */
function assertRecovery(
  original: Observations,
  resumed: Observations,
  fixture: RoundConsumptionFixture,
) {
  const starts = (events: JournalEvent[]) =>
    events.filter(({ observation }) => Boolean((observation as Record<string, any>).nativeStarted));
  const interrupted = starts(original.events).at(-1)!;
  const continued = starts(resumed.events)[0]!;
  assert.equal(continued.taskID, interrupted.taskID, 'the logical assessment survives reopening');
  assert.notEqual(continued.run, interrupted.run, 'resumption uses a fresh attempt');
  const old = (interrupted.observation as any).nativeStarted;
  const current = (continued.observation as any).nativeStarted;
  assert.equal(current.revision, old.revision, 'original captured source remains attributable');
  assert.equal(current.profile, old.profile, 'no automatic profile substitution');
  const historical = original.consumers.at(-1)!;
  assert.ok(historical.executable.endsWith('original-provider.mjs'));
  assert.ok(
    resumed.consumers[0]!.input.includes('complete second line and final conclusion survive.'),
  );
  assert.equal(
    resumed.consumers.filter(({ component }) => component === 'planner').length,
    1,
    'the resumed Planner uses its complete answer without asking it again',
  );
  assert.equal(fixture.git('status', '--porcelain'), '', 'observation never edits accepted goals');
}
