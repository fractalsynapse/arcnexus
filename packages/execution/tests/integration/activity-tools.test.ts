import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import test from 'node:test';
import type { AgentInspection } from '../../../architecture/src/index.js';
import { LocalMcp } from '../../src/mcp.js';

type Binding = AgentInspection['request']['options']['tools'][number];

/** Test the wire boundary and refusal evidence with one captured, single-path operation. */
class ToolBoundary {
  private readonly calls: string[] = [];
  private readonly refusals: string[] = [];
  private readonly binding: Binding = {
    name: 'read-file',
    handler: 'read',
    description: 'Read a fixture',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
      additionalProperties: false,
    },
  };

  /** Check the exact tool list, one valid call and refusals before invocation. */
  async run() {
    const host = new LocalMcp(
      [this.binding],
      async (_tool, args) => {
        this.calls.push(String(args.path));
        return { contents: 'fixture' };
      },
      (_name, error) => {
        if (error) this.refusals.push(error);
      },
    );
    const client = new Client({ name: 'fixture', version: '1' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(await host.start())));
      await this.verifyCalls(client);
    } finally {
      await client.close();
      await host.close();
    }
  }

  /** Compare operation requests with the exact invocations and refusals. */
  private async verifyCalls(client: Client) {
    assert.deepEqual(
      (await client.listTools()).tools.map(({ name }) => name),
      ['read-file'],
    );
    const allowed = await client.callTool({ name: 'read-file', arguments: { path: 'one' } });
    assert(!allowed.isError);
    const forbidden = await client.callTool({ name: 'shell', arguments: { command: 'pwd' } });
    assert(forbidden.isError);
    const batch = await client.callTool({
      name: 'read-file',
      arguments: { path: 'one', paths: ['two'] },
    });
    assert(batch.isError);
    assert.deepEqual(this.calls, ['one']);
    assert.match(this.refusals[0] ?? '', /not mapped/);
    assert.equal(this.refusals.length, 2);
  }
}

test('local MCP exposes only the captured operation and refuses alternate actions', () =>
  new ToolBoundary().run());
