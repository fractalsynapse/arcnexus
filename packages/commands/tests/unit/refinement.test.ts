import assert from 'node:assert/strict';
import test from 'node:test';
import { Context } from 'cordis';
import { agentPlugin } from '../../../agent/src/index.js';
import { architecturePlugin } from '../../../architecture/src/index.js';
import { RunMeasurements, type JournalEvent } from '../../../coordination/src/index.js';
import { teamPlugin } from '../../../team/src/index.js';
import { Workflow, type TaskObserver, type TaskOutcome } from '../../../workflow/src/index.js';
import { commandsPlugin } from '../../src/index.js';

export const suite = { owner: 'commands', level: 'unit', tags: ['regression'] } as const;

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
const cancelled: TaskOutcome = {
  kind: 'cancelled',
  reason: 'Interrupted during execution',
  evidence: ['checkpoint'],
};

/** Produce correlated, distinguishable child observations for each attempt. */
function frames(attempt: number): JournalEvent[] {
  const activation = attempt === 1 ? 'planner-first' : 'director-resumed';
  const records: unknown[] = [
    { refinement: { invocation: 'invocation-1', round: 1, total: 2, phase: attempt === 1 ? 'Plan' : 'Run', goal: attempt } },
    { nativeStarted: { activation, profile: attempt === 1 ? 'planner' : 'steward', model: 'model-a', reasoning: 'high' } },
    { nativeEvent: { activation, kind: 'message', event: { message: `Complete provider ${attempt}\nsecond line` } } },
    { tool: { activation, call: `call-${attempt}`, name: 'read-file', result: `Complete tool ${attempt}\nsecond line` } },
    { nativeEvent: { activation, kind: 'event', event: { type: 'turn.completed', usage: { input_tokens: attempt * 100, output_tokens: attempt * 10 } } } },
    { nativeFinished: { activation, durationMs: attempt * 20 } },
    attempt === 1
      ? { outcome: { kind: 'planned', summary: 'Planner assessment', evidence: ['plan/assessment'] } }
      : { recovering: 7, checkpoint: 'checkpoint/acknowledged', evidence: ['recovery/report'] },
    attempt === 1
      ? { refinement: { invocation: 'invocation-1', round: 1, total: 2, phase: 'Architect' } }
      : { goal: { id: 'goal-a', outcome: { kind: 'merged', commit: 'goal-commit', evidence: ['goal/checks', 'pr/615'] } } },
    attempt === 1
      ? { proposal: { path: 'proposal/exact.diff', question } }
      : { outcome: { kind: 'merged', commit: 'goal-commit', evidence: ['goal/checks'] } },
    attempt === 1
      ? { pending: { proposal: 'proposal/exact.diff' } }
      : { completedRound: { round: 1, report: 'round/one', measurements: 'measurements/report' } },
  ];
  return records.map((observation, index) => ({
    sequence: String((attempt - 1) * records.length + index + 1),
    run: attempt === 1 ? 7 : 9,
    parent: attempt === 1 ? 6 : 8,
    taskID: attempt === 1 ? 'plan-task' : 'goal-task',
    goalID: attempt === 1 ? 'plan-goal' : 'goal-a',
    timestamp: null,
    observation,
  }));
}

/** Supply a controlled Workflow without replacing the Commands plugin or its injection. */
class RefinementWorkflow extends Workflow {
  readonly calls: { directory: string; rounds: number; observer: TaskObserver; signal: AbortSignal }[] = [];
  readonly answers: (string | undefined)[] = [];
  readonly answerSignals: AbortSignal[] = [];
  cancelDuringProgress = false;

  /** Stream child records before returning the gate or aggregate outcome. */
  override async refine(directory: string, rounds: number, observer: TaskObserver, signal: AbortSignal) {
    this.calls.push({ directory, rounds, observer, signal });
    const attempt = this.calls.length;
    const accounting = new RunMeasurements();
    for (const frame of frames(attempt)) {
      observer.event?.(frame);
      accounting.accept(frame);
    }
    observer.progress({ phase: 'activity', message: `Attempt ${attempt} progress`, evidence: [`progress/${attempt}`] });
    observer.measurements?.(accounting.snapshot(0));
    if (signal.aborted) return cancelled;
    const response = await observer.answer?.(question, signal);
    this.answers.push(response);
    this.answerSignals.push(signal);
    return response === undefined ? pending : complete;
  }
}

/** Record the complete stream received by a nonterminal SDK caller. */
class CommandsScenario {
  readonly workflow = new RefinementWorkflow();
  readonly stream: unknown[] = [];
  readonly questions: string[] = [];
  response: string | undefined;
  onProgress?: () => void;
  readonly observer: TaskObserver = {
    progress: (value) => { this.stream.push({ progress: value }); this.onProgress?.(); },
    event: (value) => this.stream.push({ event: value }),
    measurements: (value) => this.stream.push({ measurements: value }),
    answer: async (value) => {
      this.questions.push(value);
      this.stream.push({ question: value });
      return this.response;
    },
  };

  /** Install actual Cordis plugins with an explicit controlled Workflow dependency. */
  async mount() {
    const context = new Context();
    await context.use(teamPlugin);
    await context.use(architecturePlugin);
    await context.use(agentPlugin);
    await context.use((scope: Context) => scope.provide('workflow', this.workflow));
    await context.use(commandsPlugin);
    assert(context.commands);
    return context.commands;
  }
}

/** Build the expected measurement snapshot from the same public accounting interface. */
function measurements(attempt: number) {
  const accounting = new RunMeasurements();
  for (const frame of frames(attempt)) accounting.accept(frame);
  return accounting.snapshot(0);
}

/** Describe every ordered callback expected before the attempt returns. */
function expectedStream(attempt: number) {
  return [
    ...frames(attempt).map((event) => ({ event })),
    { progress: { phase: 'activity', message: `Attempt ${attempt} progress`, evidence: [`progress/${attempt}`] } },
    { measurements: measurements(attempt) },
    { question },
  ];
}

test('installed SDK forwards distinct pending and resumed observations before each outcome', async () => {
  const scenario = new CommandsScenario();
  const commands = await scenario.mount();
  const signal = new AbortController().signal;
  assert.deepEqual(await commands.refine('/project', 2, scenario.observer, signal), pending);
  assert.deepEqual(scenario.stream, expectedStream(1));
  scenario.response = answer;
  assert.deepEqual(await commands.refine('/project', 2, scenario.observer, signal), complete);
  assert.deepEqual(scenario.stream, [...expectedStream(1), ...expectedStream(2)]);
  assert.deepEqual(scenario.workflow.calls, [
    { directory: '/project', rounds: 2, observer: scenario.observer, signal },
    { directory: '/project', rounds: 2, observer: scenario.observer, signal },
  ]);
  assert.deepEqual(scenario.questions, [question, question]);
  assert.deepEqual(scenario.workflow.answers, [undefined, answer]);
  assert.deepEqual(scenario.workflow.answerSignals, [signal, signal]);
  assert.equal(measurements(1).profiles[0]?.usage.input_tokens.reported, 100);
  assert.equal(measurements(2).profiles[0]?.usage.output_tokens.reported, 20);
  assert.equal(measurements(2).cost.estimate, null);
});

test('cancellation during execution reaches Workflow through the original signal', async () => {
  const scenario = new CommandsScenario();
  const commands = await scenario.mount();
  const controller = new AbortController();
  scenario.onProgress = () => controller.abort();
  const outcome = await commands.refine('/project', 2, scenario.observer, controller.signal);
  assert.deepEqual(outcome, cancelled);
  assert.equal(scenario.workflow.calls[0]?.signal, controller.signal);
  assert.equal(scenario.workflow.calls[0]?.observer, scenario.observer);
  assert.equal(controller.signal.aborted, true);
  assert.deepEqual(scenario.stream, expectedStream(1).slice(0, -1));
  assert.deepEqual(scenario.questions, []);
});
