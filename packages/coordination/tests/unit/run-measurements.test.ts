import assert from 'node:assert/strict';
import test from 'node:test';
import * as coordination from '../../src/index.js';

export const suite = { owner: 'coordination', level: 'unit', tags: ['regression'] } as const;

const usage = {
  input_tokens: 100,
  cached_input_tokens: 80,
  output_tokens: 20,
  reasoning_output_tokens: 5,
};

/** Verify accounting from journal observations without making model calls or pricing assumptions. */
class MeasurementScenario {
  private sequence = 0;
  readonly projection = new coordination.RunMeasurements();

  /** Supply ordered journal-shaped observations with a deterministic wall clock. */
  feed(observation: unknown, milliseconds: number, run = 1, parent?: number) {
    return this.projection.accept({
      sequence: String(++this.sequence),
      run,
      parent,
      taskID: 'task',
      goalID: 'goal',
      timestamp: new Date(milliseconds).toISOString(),
      observation,
    });
  }

  /** Record distinct profiles and a failure whose provider never supplied token usage. */
  run() {
    this.feed({ nativeStarted: { activation: 'first', profile: 'sol', model: 'model-a' } }, 1000);
    this.feed(
      {
        nativeEvent: {
          activation: 'first',
          kind: 'event',
          event: {
            type: 'turn.completed',
            usage,
          },
        },
      },
      1020,
    );
    this.feed({ nativeFinished: { activation: 'first', durationMs: 60 } }, 1060);
    this.feed(
      { nativeStarted: { activation: 'second', profile: 'terra', model: 'model-b' } },
      1070,
    );
    this.feed(
      { nativeFinished: { activation: 'second', durationMs: 20, failure: 'provider failed' } },
      1090,
    );
    this.feed({ outcome: { kind: 'blocked' } }, 1100);
    return this.projection.snapshot(2000);
  }
}

test('CO-25: whole-run and profile accounting preserves subsets, failures and unknown usage', () => {
  const result = new MeasurementScenario().run();
  assert.equal(result.wallElapsedMs, 100);
  assert.equal(result.nativeElapsedMs, 80);
  assert.equal(result.usage.input_tokens.reported, 100);
  assert.equal(result.usage.cached_input_tokens.reported, 80);
  assert.equal(result.usage.output_tokens.reported, 20);
  assert.equal(result.usage.reasoning_output_tokens.reported, 5);
  assert.equal(result.usage.cache_write_input_tokens.reported, null);
  assert.equal(result.usage.cache_write_input_tokens.missingTurns, 1);
  assert.equal(result.profiles.length, 2);
  const missing = result.profiles.find((profile) => profile.profile === 'terra');
  assert(missing);
  assert.equal(missing.activationsWithoutUsage, 1);
  assert.equal(missing.failedActivations, 1);
  assert.equal(missing.usage.input_tokens.reported, null);
  assert.equal(result.cost.estimate, null);
  assert.match(result.cost.reason, /pricing|billing/i);
});

test('CO-25: an active profile reports elapsed time without inventing token usage', () => {
  const scenario = new MeasurementScenario();
  scenario.feed(
    { nativeStarted: { activation: 'active', profile: 'sol', model: 'model-a' } },
    1000,
  );
  const result = scenario.projection.snapshot(1050);
  assert.equal(result.wallElapsedMs, 50);
  assert.equal(result.nativeElapsedMs, 50);
  assert.equal(result.profiles[0]!.activeActivations, 1);
  assert.equal(result.usage.input_tokens.reported, null);
});

test('CO-25: ongoing provider observations refresh elapsed measurements while usage remains unknown', () => {
  const scenario = new MeasurementScenario();
  scenario.feed({ nativeStarted: { activation: 'ongoing', profile: 'sol' } }, 1000);
  assert.equal(
    scenario.feed(
      { nativeEvent: { activation: 'ongoing', kind: 'event', event: { type: 'item.completed' } } },
      1500,
    ),
    true,
  );
  const result = scenario.projection.snapshot(1500);
  assert.equal(result.nativeElapsedMs, 500);
  assert.equal(result.usage.input_tokens.reported, null);
});

test('CO-25: a terminated unfinished activation is incomplete rather than an ever-running historical stopwatch', () => {
  const scenario = new MeasurementScenario();
  scenario.feed({ nativeStarted: { activation: 'interrupted', profile: 'sol' } }, 1000);
  scenario.feed({ outcome: { kind: 'cancelled' } }, 1100);
  const result = scenario.projection.snapshot(2000);
  assert.equal(result.nativeElapsedMs, null);
  assert.equal(result.profiles[0]!.activeActivations, 0);
  assert.equal(result.profiles[0]!.incompleteActivations, 1);
  assert.equal(result.profiles[0]!.finishedActivations, 0);
  assert.equal(result.profiles[0]!.elapsedMs, null);
  assert.equal(result.usage.input_tokens.reported, null);
});

test('processing time stops for approval and resumes without counting the wait', () => {
  const scenario = new MeasurementScenario();
  scenario.feed({ invocation: { startedAt: new Date(900).toISOString() } }, 1000);
  scenario.feed({ nativeStarted: { activation: 'before-review' } }, 1010);
  scenario.feed({ nativeFinished: { activation: 'before-review', durationMs: 400 } }, 1410);
  scenario.feed({ outcome: { kind: 'blocked' } }, 1500);
  const waiting = scenario.projection.snapshot(3000);
  assert.equal(waiting.wallElapsedMs, 600);
  assert.equal(waiting.processingElapsedMs, 600);
  scenario.feed({ invocation: { startedAt: new Date(4000).toISOString() } }, 4010, 2);
  scenario.feed({ invocation: { startedAt: new Date(4100).toISOString() } }, 4100, 3, 2);
  scenario.feed({ outcome: { kind: 'planned' } }, 4200, 2);
  const result = scenario.projection.snapshot(9000);
  assert.equal(result.wallElapsedMs, 3300);
  assert.equal(result.processingElapsedMs, 800);
  assert.equal(result.nativeElapsedMs, 400);
});
