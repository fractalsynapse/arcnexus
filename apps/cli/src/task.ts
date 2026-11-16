import type { Context } from 'cordis';
import { createInterface } from 'node:readline/promises';
import type { Observation, TaskOutcome } from '../../../packages/workflow/src/index.js';

/** Start a foreground task and forward Ctrl-C through its structured cancellation signal. */
export async function runTask(commands: Context['commands'], goal: string, json: boolean) {
  const controller = new AbortController();
  const abort = () => controller.abort(new Error('Task cancelled by SIGINT'));
  process.on('SIGINT', abort);
  try {
    const outcome = await commands.runTask(
      { directory: process.cwd(), goal },
      { progress: (observation) => reportProgress(observation, json), answer: ask },
      controller.signal,
    );
    finish(outcome, json);
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
  try {
    return await input.question(`${question}\n> `, { signal });
  } finally {
    input.close();
  }
}

/** Translate a structured outcome into the gateway exit status and terminal output. */
function finish(outcome: TaskOutcome, json: boolean) {
  if (outcome.kind === 'merged') {
    console.log(json ? JSON.stringify(outcome) : `Merged to staging: ${outcome.commit}`);
    return;
  }
  if (json && outcome.kind !== 'invalid') console.log(JSON.stringify(outcome));
  console.error([outcome.reason, ...outcome.evidence].join('\n'));
  process.exitCode = outcome.kind === 'invalid' ? 2 : outcome.kind === 'cancelled' ? 130 : 1;
}
