import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execute } from '../operations/process.js';
import { save } from '../workspace/state.js';
import type { CodexConfiguration } from './codex-configuration.js';

/** Checks effective MCP authority without launching servers or retaining untrusted configuration secrets. */
export class BridgePreflight {
  /** Retains the exact client environment and captured runtime used by the following inference. */
  constructor(private readonly configuration: CodexConfiguration) {}

  /** Rejects unexpected servers, transport settings or executable arguments before model dispatch. */
  async inspect(bridge: object): Promise<void> {
    const { client, input } = this.configuration;
    client.validate();
    const expected = (bridge as any).mcp_servers.arcnexus;
    try {
      const features = await this.query(['features', 'list'], 'features');
      for (const feature of client.disabledFeatures) {
        const row = features.split('\n').find((line) => line.split(/\s+/)[0] === feature);
        if (!row || !/\sfalse$/.test(row.trimEnd())) throw new Error('Unexpected capability');
      }
      const inventory = await this.query(
        ['mcp', 'list', '--json', ...this.overrides(expected)],
        'mcp',
      );
      this.validate(JSON.parse(inventory), expected);
      input.record.toolPreflight = { status: 'passed', servers: ['arcnexus'], clientProtocol: 1 };
    } catch {
      input.record.toolPreflight = { status: 'failed', clientProtocol: 1 };
      input.signal.throwIfAborted();
      throw new Error('Private client capability preflight failed; no model dispatched');
    } finally {
      save(input.root, input.record);
    }
  }

  /** Keeps raw effective settings private and removes them after retaining only validated outcomes. */
  private async query(args: string[], name: string): Promise<string> {
    const { client, input, env, settings } = this.configuration;
    const log = join(client.path, `${name}-preflight-${randomUUID()}.log`);
    try {
      await execute(
        { command: settings.executable, args },
        input.record.workspace,
        log,
        input.signal,
        { env, processScope: true },
      );
      return readFileSync(log, 'utf8');
    } finally {
      rmSync(log, { force: true });
    }
  }

  /** Mirrors the SDK's literal scalar/list overrides for the host-owned bridge definition. */
  private overrides(expected: Record<string, unknown>): string[] {
    return Object.entries(expected).flatMap(([key, value]) => [
      '-c',
      `mcp_servers.arcnexus.${key}=${JSON.stringify(value)}`,
    ]);
  }

  /** Compares complete transport identity while rejecting inherited environment or cwd injection. */
  private validate(result: any, expected: any): void {
    if (!Array.isArray(result)) throw new Error('Invalid MCP inventory');
    const enabled = result.filter((server) => server.enabled);
    const server = enabled[0];
    const transport = server?.transport;
    if (
      enabled.length !== 1 ||
      server.name !== 'arcnexus' ||
      transport?.type !== 'stdio' ||
      transport.command !== expected.command ||
      JSON.stringify(transport.args) !== JSON.stringify(expected.args) ||
      Object.keys(transport.env ?? {}).length ||
      (transport.env_vars ?? []).length ||
      transport.cwd
    )
      throw new Error('Unexpected MCP authority');
  }
}
