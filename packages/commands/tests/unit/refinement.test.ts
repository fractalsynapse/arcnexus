import assert from 'node:assert/strict';
import test from 'node:test';
import type { Context } from 'cordis';
import { RunMeasurements, type JournalEvent } from '../../../coordination/src/index.js';
import { Workflow, type TaskObserver, type TaskOutcome } from '../../../workflow/src/index.js';
import { commandsPlugin } from '../../src/index.js';

export const suite = { owner: 'commands', level: 'unit', tags: ['regression'] } as const;

type Refine = (
  directory: string,
  rounds: number,
  observer: TaskObserver,
  signal: AbortSignal,
) => Promise<TaskOutcome>;

const question = 'Approve the exact proposal?\n  Preserve this second line.';
const answer = 'Approved with context.\n  Keep this whitespace.\n';
const pending: TaskOutcome = {
  kind: 'blocked',
  reason: 'Architecture approval is pending',
  evidence: ['proposal/exact.diff', 'round/one'],
};
const complete: TaskOutcome = {
  kind: 'planned',
  commit: 'accepted-staging',
  summary: 'Two rounds assessed',
  evidence: ['round/one', 'round/two', 'measurements/report'],
};

/** Provide distinguishable Workflow observations and outcomes to an SDK caller. */
class RefinementWorkflow extends Workflow {
  readonly calls: { directory: string; rounds: number; observer: TaskObserver; signal: AbortSignal }[] = [];
  readonly answers: (string | undefined)[] = [];

  /** Emit the same structured stream and gate response through the supplied observer. */
  override async refine(directory: string, rounds: number, observer: TaskObserver, signal: AbortSignal) {
    this.calls.push({ directory, rounds, observer, signal });
    if (signal.aborted)
      return { kind: 'cancelled' as const, reason: 'Interrupted', evidence: ['checkpoint'] };
    const observations = [
      { refinement: { invocation: 'invocation-1', round: 1, total: rounds, phase: 'Plan' } },
      { nativeEvent: { activation: 'planner', event: { message: 'Complete provider\nmessage' } } },
      { tool: { call: 'read-file', result: 'Complete tool\nresult' } },
      { refinement: { invocation: 'invocation-1', round: 1, total: rounds, phase: 'Architect' } },
    ];
    observations.forEach((observation, index) => observer.event?.(this.frame(index + 1, observation)));
    observer.progress({ phase: 'activity', message: 'Round 1 · Architect', evidence: ['proposal/exact.diff'] });
    observer.measurements?.(new RunMeasurements().snapshot(0));
    const response = await observer.answer?.(question, signal);
    this.answers.push(response);
    if (response === undefined) return pending;
    observer.event?.(this.frame(5, {
      refinement: { invocation: 'invocation-1', round: 2, total: rounds, phase: 'Run', goal: 1 },
    }));
    return complete;
  }

  /** Preserve source and correlation identities in each simulated persisted frame. */
  private frame(sequence: number, observation: unknown): JournalEvent {
    return { sequence: String(sequence), run: 7, taskID: 'task-1', goalID: 'goal-1', timestamp: null, observation };
  }
}

/** Mount the public plugin against an explicit Workflow dependency without terminal facilities. */
class CommandsScenario {
  readonly workflow = new RefinementWorkflow();
  readonly frames: JournalEvent[] = [];
  readonly progress: Parameters<TaskObserver['progress']>[0][] = [];
  readonly measurements: ReturnType<RunMeasurements['snapshot']>[] = [];
  readonly questions: string[] = [];
  response: string | undefined;
  readonly observer: TaskObserver = {
    progress: (value) => this.progress.push(value),
    event: (value) => this.frames.push(value),
    measurements: (value) => this.measurements.push(value),
    answer: async (value) => {
      this.questions.push(value);
      return this.response;
    },
  };
  readonly commands: Context['commands'];

  /** Capture the service registered by the actual Commands plugin. */
  constructor() {
    let registered: Context['commands'] | undefined;
    const context = {
      workflow: this.workflow,
      provide: (_name: string, service: Context['commands']) => { registered = service; },
    } as unknown as Context;
    commandsPlugin.apply(context);
    assert(registered);
    this.commands = registered;
  }

  /** Resolve the contractual public method while the pre-implementation type remains unchanged. */
  refine(): Refine {
    const method: unknown = Reflect.get(this.commands, 'refine');
    assert.equal(typeof method, 'function', 'Commands exposes structured refinement');
    return method as Refine;
  }
}

test('a headless SDK caller receives pending and resumed refinement with complete ordered observations', async () => {
  const scenario = new CommandsScenario();
  const refine = scenario.refine();
  const signal = new AbortController().signal;
  assert.deepEqual(await refine('/project', 2, scenario.observer, signal), pending);
  scenario.response = answer;
  assert.deepEqual(await refine('/project', 2, scenario.observer, signal), complete);
  assert.deepEqual(scenario.workflow.calls, [
    { directory: '/project', rounds: 2, observer: scenario.observer, signal },
    { directory: '/project', rounds: 2, observer: scenario.observer, signal },
  ]);
  assert.deepEqual(scenario.questions, [question, question]);
  assert.deepEqual(scenario.workflow.answers, [undefined, answer]);
  assert.deepEqual(scenario.frames.map((frame) => frame.sequence), ['1', '2', '3', '4', '1', '2', '3', '4', '5']);
  assert.deepEqual(scenario.frames[1]?.observation, {
    nativeEvent: { activation: 'planner', event: { message: 'Complete provider\nmessage' } },
  });
  assert.deepEqual(scenario.frames[2]?.observation, {
    tool: { call: 'read-file', result: 'Complete tool\nresult' },
  });
  assert.deepEqual(scenario.progress[0], {
    phase: 'activity', message: 'Round 1 · Architect', evidence: ['proposal/exact.diff'],
  });
  assert.equal(scenario.measurements.length, 2);
  assert.equal(scenario.measurements[0]?.cost.estimate, null);
});

test('cancellation remains the Workflow outcome and retains the supplied signal', async () => {
  const scenario = new CommandsScenario();
  const controller = new AbortController();
  controller.abort();
  const outcome = await scenario.refine()('/project', 1, scenario.observer, controller.signal);
  assert.deepEqual(outcome, { kind: 'cancelled', reason: 'Interrupted', evidence: ['checkpoint'] });
  assert.equal(scenario.workflow.calls[0]?.signal, controller.signal);
});
