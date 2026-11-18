import { writeFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/** Observe the actual harness arguments, stdin, cwd and exposed MCP tools. */
async function main() {
  const args = process.argv.slice(2);
  const entry = args.find((arg) => arg.startsWith('mcp_servers='));
  const url = entry?.match(/url="([^"]+)"/)?.[1];
  if (!url) throw new Error('Missing MCP endpoint');
  const client = new Client({ name: 'fixture', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  const tools = (await client.listTools()).tools;
  await client.close();
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  writeFileSync(
    process.env.PARITY_OBSERVATION!,
    JSON.stringify({ args, input, cwd: process.cwd(), tools }),
  );
  process.stdout.write(
    JSON.stringify({
      type: 'item.completed',
      item: { type: 'agent_message', text: process.env.PARITY_RESPONSE ?? '{}' },
    }) + '\n',
  );
}

await main();
