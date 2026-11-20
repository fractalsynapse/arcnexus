import { InvalidAgentResponse } from '../../agent/src/index.js';
import type { ProcessObservation } from './process.js';

/** Distinguish an unreadable actor answer from a failed harness process. */
export class InvalidCodexResponse extends InvalidAgentResponse {}

export type CodexObservation =
  | { kind: 'invocation'; command: string; args: readonly string[]; cwd: string }
  | { kind: 'event'; event: unknown }
  | { kind: 'stderr'; text: string }
  | { kind: 'invalid-output'; text: string; diagnostic: string };

/** Decode the live provider stream without suppressing unknown events or retaining another full transcript. */
export class CodexEvents {
  private pending = '';
  private message?: string;
  private invalid?: string;

  /** Keep raw transcript identity available in every response diagnostic. */
  constructor(
    private readonly log: string,
    private readonly observe?: (event: CodexObservation) => void,
  ) {}

  /** Retain complete Unicode records across transport boundaries and preserve stderr separately. */
  accept(output: ProcessObservation) {
    if (output.channel === 'stderr') {
      this.observe?.({ kind: 'stderr', text: output.text });
      return;
    }
    this.pending += output.text;
    let boundary: number;
    while ((boundary = this.pending.indexOf('\n')) !== -1) {
      const line = this.pending.slice(0, boundary);
      this.pending = this.pending.slice(boundary + 1);
      this.record(line);
    }
  }

  /** Flush an unterminated final record and validate the complete final actor response. */
  answer(): unknown {
    if (this.pending) this.record(this.pending);
    this.pending = '';
    if (this.invalid)
      throw new InvalidCodexResponse(`${this.invalid}; evidence: ${this.log}`, {
        identity: this.invalid,
      });
    if (!this.message)
      throw new InvalidCodexResponse(`Codex returned no final response; evidence: ${this.log}`, {
        identity: 'Codex returned no final response',
      });
    try {
      return JSON.parse(this.message);
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : String(error);
      throw new InvalidCodexResponse(
        `Codex returned an invalid task response: ${diagnostic}; evidence: ${this.log}`,
        { identity: `Codex returned an invalid task response: ${diagnostic}`, cause: error },
      );
    }
  }

  /** Observe every decoded event while selecting only a genuine final agent message as the answer. */
  private record(line: string) {
    if (!line.trim()) return;
    let event: any;
    try {
      event = JSON.parse(line);
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : String(error);
      this.invalid = `Codex returned an invalid event: ${diagnostic}`;
      this.observe?.({ kind: 'invalid-output', text: line, diagnostic });
      return;
    }
    this.observe?.({ kind: 'event', event });
    if (event?.type === 'item.completed' && event.item?.type === 'agent_message')
      this.message = typeof event.item.text === 'string' ? event.item.text : undefined;
  }
}
