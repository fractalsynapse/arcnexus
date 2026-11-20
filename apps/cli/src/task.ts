import type { Context } from 'cordis';
import { createInterface } from 'node:readline';
import type { JournalEvent } from '../../../packages/coordination/src/index.js';
import type {
  Observation,
  RoundOutcome,
  TaskOutcome,
  TaskObserver,
} from '../../../packages/workflow/src/index.js';

/** Start a foreground operation and forward Ctrl-C through structured cancellation. */
export async function runTask(
  commands: Context['commands'],
  goal: string | undefined,
  json: boolean,
  verb: 'run' | 'plan' | 'update' | 'refine',
  rounds = '1',
) {
  const controller = new AbortController();
  const abort = () => controller.abort(new Error('Task cancelled by SIGINT'));
  process.on('SIGINT', abort);
  try {
    await dispatchTask(commands, goal, json, verb, rounds, controller.signal);
  } finally {
    process.off('SIGINT', abort);
  }
}

/** Translate this foreground invocation into the corresponding structured SDK operation. */
async function dispatchTask(
  commands: Context['commands'],
  goal: string | undefined,
  json: boolean,
  verb: 'run' | 'plan' | 'update' | 'refine',
  rounds: string,
  signal: AbortSignal,
) {
  const observer: TaskObserver = {
    progress: (entry) => reportProgress(entry, json),
    event: (entry) => reportEvent(entry, json),
    measurements: (entry) => reportMeasurements(entry, json),
    answer: ask,
  };
  const directory = process.cwd();
  if (verb === 'update')
    return finish(await commands.updateArchitecture(directory, goal, observer, signal), json);
  if (verb === 'plan')
    return finish(await commands.planTask(directory, goal, observer, signal), json);
  if (verb === 'refine')
    return finish(await commands.refine(directory, rounds, observer, signal), json);
  if (goal === undefined)
    finishRound(await commands.runRound(directory, observer, signal), json, signal);
  else finish(await commands.runTask({ directory, goal }, observer, signal), json);
}

/** Stream task progress in the chosen output representation. */
function reportProgress(observation: Observation, json: boolean) {
  const message = [observation.message, ...(observation.evidence ?? [])].join('\n');
  if (json) console.log(JSON.stringify({ type: 'progress', observation }));
  else console.log(message);
}

/** Render the complete persisted observation with its sequence and provenance while work runs. */
function reportEvent(event: JournalEvent, json: boolean) {
  if (json) console.log(JSON.stringify({ type: 'event', ...event }));
  else
    console.log(
      `${event.timestamp ?? 'Time unknown'} · run ${event.run} · event ${event.sequence}\n${JSON.stringify({ observation: event.observation, detail: event.detail }, null, 2)}`,
    );
}

/** Show observed totals per execution profile without inventing pricing or a work budget. */
function reportMeasurements(
  measurements: Parameters<NonNullable<TaskObserver['measurements']>>[0],
  json: boolean,
) {
  if (json) console.log(JSON.stringify({ type: 'measurements', measurements }));
  else console.log(`Run measurements\n${JSON.stringify(measurements, null, 2)}`);
}

/** Ask for input on a terminal and allow a noninteractive caller to leave the gate open. */
async function ask(question: string, signal: AbortSignal) {
  if (!process.stdin.isTTY) return undefined;
  const input = createInterface({ input: process.stdin, output: process.stderr });
  const abort = () => input.close();
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    const lines: string[] = [];
    process.stderr.write(
      `${question}\nEnter your answer, then a line containing only a period to submit.\n`,
    );
    for await (const line of input) {
      if (line === '.') return lines.join('\n');
      lines.push(line);
    }
  } finally {
    signal.removeEventListener('abort', abort);
    input.close();
  }
}

/** Render one aggregate round while keeping the failing goal's diagnostic visible. */
function finishRound(round: RoundOutcome, json: boolean, signal: AbortSignal) {
  if (json) console.log(JSON.stringify({ type: 'result', outcome: round }));
  else {
    for (const { id, outcome } of round.goals) {
      const summary = outcome.kind === 'satisfied' ? ` · ${outcome.summary}` : '';
      console.log(`${id}: ${outcome.kind}${summary}`);
    }
    console.log(`Round ${round.round} ${round.completed ? 'completed' : 'stopped'}`);
  }
  if (round.completed) return;
  const last = round.goals.at(-1)?.outcome;
  if (last && 'reason' in last) finish(last, false);
  else process.exitCode = signal.aborted ? 130 : 1;
}

/** Translate a structured outcome into the gateway exit status and terminal output. */
function finish(outcome: TaskOutcome, json: boolean) {
  if (json && outcome.kind !== 'invalid') console.log(JSON.stringify({ type: 'result', outcome }));
  if (!json && outcome.kind === 'planned') console.log(outcome.summary);
  if (!json && (outcome.kind === 'merged' || outcome.kind === 'satisfied'))
    console.log(
      `${outcome.kind === 'merged' ? 'Merged to staging' : 'Measure satisfied'}: ${outcome.commit}`,
    );
  if ('reason' in outcome) {
    console.error([outcome.reason, ...outcome.evidence].join('\n'));
    process.exitCode = outcome.kind === 'invalid' ? 2 : outcome.kind === 'cancelled' ? 130 : 1;
  }
}
