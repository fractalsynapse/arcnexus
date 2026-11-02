import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { observe } from '../report/timeline.js';
import { openBridge, protocolTimeoutSeconds } from '../steward/bridge.js';
import { save, type RecordData } from '../workspace/state.js';

/** Qualifies transport connectivity; declared finite probes run as shared lifecycle operations. */
export async function prepareCapabilities(
  root: string,
  record: RecordData,
  signal: AbortSignal,
): Promise<void> {
  const probes: unknown[] = [];
  record.probes = probes;
  record.stage = 'capability-probes';
  await new BridgeProbe(root, record, signal, probes).run();
}

/** Checks the actual parent-to-bridge route before stewards depend on its tools. */
class BridgeProbe {
  private readonly client = new Client(
    { name: 'arcnexus-capability-probe', version: '1' },
    { capabilities: {} },
  );

  private readonly abort = () => {
    void this.client.close();
  };

  private readonly start = Date.now();

  /** Retains the shared probe ledger and cancellation for the bridge connectivity check. */
  constructor(
    private readonly root: string,
    private readonly record: RecordData,
    private readonly signal: AbortSignal,
    private readonly probes: unknown[],
  ) {}

  /** Executes this lifecycle through its configured collaborators and propagates failures. */
  async run(): Promise<void> {
    const bridge = await openBridge(
      [{ name: 'probe', description: 'Connectivity probe', inputSchema: { type: 'object' } }],
      async () => ({ ok: true }),
    );
    this.signal.addEventListener('abort', this.abort, { once: true });
    try {
      await this.check(bridge.config);
      this.passed();
    } catch (error) {
      this.failed(error);
      throw error;
    } finally {
      this.signal.removeEventListener('abort', this.abort);
      await this.client.close();
      await bridge.close();
      save(this.root, this.record);
    }
  }

  /** Checks the required invariant before allowing the next transition. */
  private async check(configuration: Record<string, unknown>): Promise<void> {
    const config = (configuration.mcp_servers as { arcnexus: { command: string; args: string[] } })
      .arcnexus;
    this.signal.throwIfAborted();
    await this.client.connect(
      new StdioClientTransport({ command: config.command, args: config.args }),
      { timeout: protocolTimeoutSeconds * 1000 },
    );
    const result = await this.client.callTool({ name: 'probe', arguments: {} }, undefined, {
      timeout: protocolTimeoutSeconds * 1000,
    });
    this.signal.throwIfAborted();
    if (result.isError) throw new Error('Bridge functional probe failed');
  }

  /** Records successful capability evidence before model activation. */
  private passed(): void {
    const evidence = {
      route: 'stdio-mcp',
      status: 'passed',
      durationMs: Date.now() - this.start,
      transport: 'ArcNexus bridge',
      runtime: process.version,
    };
    this.probes.push(evidence);
    observe(this.root, this.record, 'probe.completed', evidence);
  }

  /** Records an unavailable required capability and its diagnostic. */
  private failed(error: unknown): void {
    this.probes.push({
      route: 'stdio-mcp',
      status: 'failed',
      error: String(error),
      durationMs: Date.now() - this.start,
    });
    observe(this.root, this.record, 'probe.failed', this.probes.at(-1));
  }
}
