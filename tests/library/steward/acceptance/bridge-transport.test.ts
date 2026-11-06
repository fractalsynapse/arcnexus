import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import type { TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { openBridge } from '../../../../dist/library/steward/bridge.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Qualifies complete responses and disconnect behavior through the production socket and MCP bridge. */
class BridgeTransportScenarios {
  /** Preserves complete large results and serves a follow-up through one MCP connection. */
  async largeResponse(t: TestContext): Promise<void> {
    const payload = 'large-evidence-'.repeat(20_000);
    const bridge = await openBridge(
      [{ name: 'evidence.read', description: 'Read evidence', inputSchema: { type: 'object' } }],
      async (_name, args) => ({ value: (args as any).small ? 'small-result' : payload }),
    );
    const client = new Client({ name: 'bridge-response-acceptance', version: '1' });
    t.after(async () => {
      await client.close();
      await bridge.close();
    });
    await client.connect(new StdioClientTransport((bridge.config as any).mcp_servers.arcnexus));

    const large = (await client.callTool({ name: 'evidence.read', arguments: {} })) as any;
    assert.equal(JSON.parse(large.content[0].text).value, payload);
    const small = (await client.callTool({
      name: 'evidence.read',
      arguments: { small: true },
    })) as any;
    assert.equal(JSON.parse(small.content[0].text).value, 'small-result');
  }

  /** Fails active and later calls when the existing production connection disconnects. */
  async disconnect(t: TestContext): Promise<void> {
    const active = await this.pendingCall(t);
    const pending = this.settle(active.client.callTool({ name: 'evidence.read', arguments: {} }));
    assert.notEqual(await this.settle(active.started), null, 'host tool must begin');

    const closing = active.closeBridge();
    this.assertFailed(await pending, 'pending tool call must fail after disconnect');
    active.release({ value: 'late' });
    await closing;
    const later = active.client.callTool({ name: 'evidence.read', arguments: {} });
    this.assertFailed(await this.settle(later), 'subsequent call must fail promptly');
  }

  /** Opens production MCP wiring around a tool whose result can be released after disconnect. */
  private async pendingCall(t: TestContext) {
    let release!: (value: unknown) => void;
    let markStarted!: () => void;
    let closing: Promise<void> | undefined;
    const started = new Promise<void>((resolveStarted) => {
      markStarted = resolveStarted;
    });
    const result = new Promise<unknown>((resolveResult) => {
      release = resolveResult;
    });
    const bridge = await openBridge(
      [{ name: 'evidence.read', description: 'Read evidence', inputSchema: { type: 'object' } }],
      async () => {
        markStarted();
        return result;
      },
    );
    const client = new Client({ name: 'bridge-disconnect-acceptance', version: '1' });
    const closeBridge = () => (closing ??= bridge.close());
    t.after(async () => {
      release({});
      await client.close();
      await closeBridge();
    });
    await client.connect(new StdioClientTransport((bridge.config as any).mcp_servers.arcnexus));
    return { bridge, client, closeBridge, release, started };
  }

  /** Converts a client result, rejection, or timeout into a bounded observation. */
  private async settle(promise: Promise<unknown>): Promise<unknown | null> {
    return Promise.race([
      promise.then(
        (value) => ({ value }),
        (error) => ({ error }),
      ),
      delay(1000).then(() => null),
    ]);
  }

  /** Requires a disconnected call to reject or return an MCP tool error. */
  private assertFailed(outcome: unknown, message: string): void {
    assert.notEqual(outcome, null, message);
    const result = outcome as { error?: unknown; value?: { isError?: boolean } };
    assert.ok('error' in result || result.value?.isError === true, message);
  }
}

const scenarios = new BridgeTransportScenarios();

test('large bridge response remains readable over the production MCP client', (t) =>
  scenarios.largeResponse(t));

test('bridge disconnect fails active and subsequent tool calls promptly', (t) =>
  scenarios.disconnect(t));

registerSuite({
  component: 'steward',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
