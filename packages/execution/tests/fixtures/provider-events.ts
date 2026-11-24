#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const events = [
  { type: 'thread.started', thread_id: 'fixture-thread' },
  {
    type: 'item.completed',
    item: { type: 'agent_message', text: 'Opening café 🛠\nChecking the project' },
  },
  { type: 'vendor.future', value: 'café 🛠' },
  {
    type: 'item.completed',
    item: {
      type: 'mcp_tool_call',
      id: 'tool-1',
      tool: 'list-files',
      result: { answer: 'complete answer' },
    },
  },
  {
    type: 'turn.completed',
    usage: {
      input_tokens: 100,
      cached_input_tokens: 80,
      output_tokens: 20,
      reasoning_output_tokens: 5,
    },
  },
  { type: 'item.completed', item: { type: 'agent_message', text: '{"kind":"completed"}' } },
];

/** Emit controlled provider records through real pipes; this fixture is not a live inference proof. */
class ProviderEvents {
  /** Preserve Unicode, unknown events, tool data, usage and a valid final structured answer. */
  run() {
    const request = readFileSync(0, 'utf8');
    for (const event of events) {
      const value = event.type === 'vendor.future' ? { ...event, request } : event;
      process.stdout.write(JSON.stringify(value) + '\n');
    }
    process.stderr.write('provider diagnostic café 🛠\n');
  }
}

new ProviderEvents().run();
