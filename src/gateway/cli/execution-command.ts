import { Portfolio } from '../../library/portfolio/portfolio.js';
import { createInterface } from 'node:readline/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { HostClient } from '../../library/execution-runtime/host-client.js';
import { RunReadout } from './run-readout.js';
import type { ExecutionRun, RunStance } from '../../library/coordination-store/execution-types.js';

/** Adapts the minimal user commands to persistent project execution. */
export class ExecutionCommand {
  private readonly client: HostClient;

  /** Retains caller cancellation without coupling background workday lifetime to the terminal. */
  constructor(
    private readonly signal: AbortSignal,
    packageReference?: string,
  ) {
    if (packageReference === undefined) this.client = new HostClient(process.cwd());
    else {
      const portfolio = new Portfolio();
      try {
        const target = portfolio.packageTarget(packageReference);
        this.client = new HostClient(target.source, undefined, target);
      } finally {
        portfolio.close();
      }
    }
  }

  /** Applies one option-free workday control and prints its authoritative state. */
  async workday(action: string, simulate = false): Promise<void> {
    if (action === 'start') await this.client.ensureRun(action, simulate, this.signal);
    else await this.client.ensure(action, this.signal);
    console.log(JSON.stringify(await this.client.request({ action, simulate }), null, 2));
  }

  /** Submits a prompt and streams changed state until completion, cancellation or missing input. */
  async task(
    prompt: string,
    asynchronous = false,
    simulate = false,
    stance?: RunStance,
  ): Promise<void> {
    await this.client.ensureRun('submit', simulate, this.signal, stance);
    const run = (await this.client.request({
      action: 'submit',
      prompt,
      simulate,
      ...(stance ? { stance } : {}),
    })) as ExecutionRun;
    if (asynchronous) {
      console.log(JSON.stringify(run));
      return;
    }
    await this.followTask(run);
  }

  /** Observes an attached task while preserving cancellation ownership across external pauses. */
  private async followTask(run: ExecutionRun): Promise<void> {
    // One readout for every stance: the stored event sequence, emitted as JSON lines. Polling the
    // report and printing it whenever the bytes differ made the stream a projection of a projection,
    // so two runs of the same work could print differently for reasons unrelated to the run.
    const readout = new RunReadout(
      (action, extra) => this.client.request({ action, id: run.id, ...(extra ?? {}) }),
      run.id,
    );
    while (!this.signal.aborted) {
      await readout.poll();
      const result = await this.client.request({ action: 'task-status', id: run.id });
      if (result.run.status === 'needs_input' && (await this.answer(result.run))) continue;
      if (this.signal.aborted) break;
      if (!['running', 'pausing', 'paused'].includes(result.run.status)) {
        process.exitCode =
          result.run.status === 'completed' ? 0 : result.run.status === 'cancelled' ? 130 : 1;
        return;
      }
      await delay(200);
    }
    await this.client.request({ action: 'cancel', id: run.id });
    process.exitCode = 130;
  }

  /** Asks only genuine director questions; noninteractive callers retain needs-input evidence. */
  private async answer(run: ExecutionRun): Promise<boolean> {
    if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    const closed = new AbortController();
    terminal.once('close', () => closed.abort(new Error('Terminal disconnected')));
    try {
      const answer = await terminal.question(
        JSON.stringify(run.data.questions ?? run.data.architectureProposal) + '\nYour response: ',
        { signal: AbortSignal.any([this.signal, closed.signal]) },
      );
      await this.client.request({ action: 'answer', id: run.id, answer });
      return true;
    } catch {
      return false;
    } finally {
      terminal.close();
    }
  }
}
