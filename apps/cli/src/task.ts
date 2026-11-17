import type { Context } from 'cordis';
import { createInterface } from 'node:readline';
import type {
  Observation,
  RoundOutcome,
  TaskOutcome,
  TaskObserver,
} from '../../../packages/workflow/src/index.js';

/** Start a foreground task and forward Ctrl-C through its structured cancellation signal. */
export async function runTask(
  commands: Context['commands'],
  goal: string | undefined,
  json: boolean,
) {
  const controller = new AbortController();
  const abort = () => controller.abort(new Error('Task cancelled by SIGINT'));
  process.on('SIGINT', abort);
  try {
    const observer: TaskObserver = {
      progress: (observation) => reportProgress(observation, json),
      answer: ask,
    };
    if (goal === undefined)
      finishRound(
        await commands.runRound(process.cwd(), observer, controller.signal),
        json,
        controller.signal,
      );
    else
      finish(
        await commands.runTask({ directory: process.cwd(), goal }, observer, controller.signal),
        json,
      );
  } finally {
    process.off('SIGINT', abort);
  }
}

/** Stream task progress in the chosen output representation. */
function reportProgress(observation: Observation, json: boolean) {
  const message = [observation.message, ...(observation.evidence ?? [])].join('\n');
  if (json) console.error(message);
  else console.log(message);
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
  if (json) console.log(JSON.stringify(round));
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
  if (outcome.kind === 'merged' || outcome.kind === 'satisfied') {
    console.log(
      json
        ? JSON.stringify(outcome)
        : `${outcome.kind === 'merged' ? 'Merged to staging' : 'Measure satisfied'}: ${outcome.commit}`,
    );
    return;
  }
  if (json && outcome.kind !== 'invalid') console.log(JSON.stringify(outcome));
  console.error([outcome.reason, ...outcome.evidence].join('\n'));
  process.exitCode = outcome.kind === 'invalid' ? 2 : outcome.kind === 'cancelled' ? 130 : 1;
}
