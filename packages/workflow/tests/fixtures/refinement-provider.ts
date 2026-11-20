#!/usr/bin/env node
import { readFileSync } from 'node:fs';

interface Input {
  attempt: number;
  clarifications?: { question: string; answer: string }[];
}

/** Emit controlled native observations and use the real mapped clarification transport. */
class RefinementProvider {
  /** Ask once, then expose a distinct complete finding and explicit provider usage. */
  async run() {
    const input = JSON.parse(readFileSync(0, 'utf8')) as Input;
    if (!input.clarifications?.length) {
      await this.question(input.attempt);
      this.emit({ type: 'item.completed', item: { type: 'agent_message', text: '{}' } });
      return;
    }
    const answer = input.clarifications.at(-1)!.answer;
    this.emit({
      type: 'item.completed',
      item: {
        type: 'agent_message',
        text: JSON.stringify({ finding: 'Provider finding attempt ' + input.attempt, answer }),
      },
    });
    this.emit({
      type: 'turn.completed',
      usage: { input_tokens: input.attempt * 19, output_tokens: input.attempt * 7 },
    });
  }

  /** Submit a real host question rather than authoring clarification journal records. */
  private async question(attempt: number) {
    const setting = process.argv.find((arg) => arg.startsWith('mcp_servers='));
    if (!setting) throw new Error('Missing native MCP binding');
    const url = JSON.parse(setting.split('url=')[1]!.split(',required=')[0]!) as string;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: { name: 'ask-question', arguments: { question: 'Complete answer ' + attempt } },
      }),
    });
    const result = await response.json() as { error?: unknown; result?: { isError?: boolean } };
    if (!response.ok || result.error || result.result?.isError)
      throw new Error('Question refused: ' + JSON.stringify(result));
  }

  /** Preserve complete JSONL records in the provider pipe consumed by Execution. */
  private emit(event: unknown) {
    process.stdout.write(JSON.stringify(event) + '\n');
  }
}

await new RefinementProvider().run();
