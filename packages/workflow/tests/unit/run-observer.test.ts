import assert from 'node:assert/strict';
import test from 'node:test';
import type { JournalEvent, RunMeasurements } from '../../../coordination/src/index.js';
import { RunObserver } from '../../src/observer.js';
import type { TaskEvent, TaskSession } from '../../src/services.js';

export const suite = { owner: 'workflow', level: 'unit', tags: ['regression'] } as const;

/** Verify that nested lifecycle consumers share one projection and preserve the foreground caller. */
class ObserverScenario {
  readonly frames: JournalEvent[] = [];
  readonly totals: ReturnType<RunMeasurements['snapshot']>[] = [];
  readonly answers: string[] = [];
  readonly observer: RunObserver;

  /** Capture structured callbacks without a CLI, provider, store or additional scheduler. */
  constructor() {
    this.observer = RunObserver.for({
      progress: () => {},
      event: (frame) => this.frames.push(frame),
      measurements: (value) => this.totals.push(value),
      answer: async (question) => {
        this.answers.push(question);
        return 'Complete human answer';
      },
    });
  }

  /** Observe a valid journal identity with complete payload and provider usage. */
  feed(sequence: string, observation: unknown) {
    this.observer.event({
      sequence,
      run: 1,
      taskID: 'task',
      goalID: 'goal',
      timestamp: new Date().toISOString(),
      observation,
    });
  }
}

test('nested observation shares one projection and returns the complete original human answer', async () => {
  const scenario = new ObserverScenario();
  assert.equal(RunObserver.for(scenario.observer), scenario.observer);
  scenario.feed('1', { nativeStarted: { activation: 'native', profile: 'sol', model: 'model' } });
  scenario.feed('2', {
    nativeEvent: {
      activation: 'native',
      event: { type: 'turn.completed', usage: { input_tokens: 100 } },
    },
  });
  scenario.feed('2', {
    nativeEvent: {
      activation: 'native',
      event: { type: 'turn.completed', usage: { input_tokens: 100 } },
    },
  });
  assert.equal(scenario.totals.at(-1)!.usage.input_tokens.reported, 100);
  assert.equal(
    await scenario.observer.answer('Clarify the goal', new AbortController().signal),
    'Complete human answer',
  );
  assert.deepEqual(scenario.answers, ['Clarify the goal']);
});

test('each admitted session records its own question and preserves the complete caller answer', async () => {
  const scenario = new ObserverScenario();
  const events: TaskEvent[] = [];
  const session = { record: (event: TaskEvent) => events.push(event) } as unknown as TaskSession;
  const child = { record: (event: TaskEvent) => events.push(event) } as unknown as TaskSession;
  scenario.observer.admittedSession(session);
  scenario.observer.admittedSession(child);
  const signal = new AbortController().signal;
  assert.equal(await session.ask!('Parent question', signal), 'Complete human answer');
  assert.equal(await child.ask!('Child question', signal), 'Complete human answer');
  assert.deepEqual(scenario.answers, ['Parent question', 'Child question']);
  assert.equal(events.filter((event) => 'invocation' in event).length, 1);
  assert.deepEqual(
    events.filter((event) => 'phase' in event),
    [
      { phase: 'question', message: 'Parent question' },
      { phase: 'question', message: 'Child question' },
    ],
  );
});
