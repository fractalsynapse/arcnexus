import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { operationTool } from '../../../architecture/src/index.js';
import { LocalMcp } from '../../src/mcp.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

interface Observation {
  call: string;
  phase: string;
  args?: unknown;
  result?: unknown;
  durationMs?: number;
}

/** Inspect actual local MCP dispatch rather than relying on provider-reported tool claims. */
class McpScenario {
  readonly observations: Observation[] = [];
  readonly client = new Client({ name: 'observations', version: '1' });
  readonly host: LocalMcp;

  /** Bind controlled read results and observe full calls and refusals through the real SDK. */
  constructor(t: TestContext) {
    this.host = new LocalMcp(
      [operationTool('list-files', 'list')],
      async () => ['complete café 🛠', 'another file'],
      (_name: string, _error?: string, event?: Observation) => {
        if (event) this.observations.push(event);
      },
    );
    t.after(async () => {
      await this.client.close();
      await this.host.close();
    });
  }

  /** Assert one canonical host attempt has both its complete input and actual outcome. */
  async run() {
    await this.client.connect(new StreamableHTTPClientTransport(new URL(await this.host.start())));
    const args = { path: '.' };
    const result = await this.client.callTool({ name: 'list-files', arguments: args });
    assert(!result.isError);
    assert.equal(this.observations.length, 2);
    assert.equal(this.observations[0]?.phase, 'started');
    assert.deepEqual(this.observations[0]?.args, args);
    assert.equal(this.observations[1]?.call, this.observations[0]?.call);
    assert.deepEqual(this.observations[1]?.result, result);
    assert((this.observations[1]?.durationMs ?? -1) >= 0);
    await this.client.callTool({ name: 'unmapped-operation', arguments: {} });
    assert.equal(this.observations.at(-1)?.phase, 'refused');
  }
}

test('EX-26: MCP observes complete call/result pairs and correlated refusals', async (t) => {
  await new McpScenario(t).run();
});
