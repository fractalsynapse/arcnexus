import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/** Observe the native subprocess boundary without invoking a model. */
export class HarnessProbe {
  /** Record actual stdin, argv, cwd and the tool surface exposed by the host. */
  static async run(argv: string[]) {
    const uri = argv
      .find((entry) => entry.startsWith('mcp_servers='))
      ?.match(/url="(http:\/\/127\.0\.0\.1:\d+\/[^"]+)"/)?.[1];
    if (!uri) throw new Error('The harness did not receive its local MCP binding');
    const input: string[] = [];
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) input.push(String(chunk));
    const client = new Client({ name: 'harness-probe', version: '1' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(uri)));
      const { tools } = await client.listTools();
      const observation = { input: input.join(''), argv, cwd: process.cwd(), tools };
      writeFileSync(join(process.cwd(), 'observed.json'), JSON.stringify(observation));
    } finally {
      await client.close();
    }
    process.stdout.write(
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: '{}' } }) +
        '\n',
    );
  }
}
