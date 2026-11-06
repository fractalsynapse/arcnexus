import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { connect } from 'node:net';
import type { BridgeTool } from './bridge.js';
import { BridgeResponseBuffer } from './bridge-response-buffer.js';

/** Forwards constrained MCP requests to the private parent-owned operation connection. */
class BridgeClient {
  private readonly socket = connect(process.argv[2]!);

  private sequence = 0;

  private readonly input = new BridgeResponseBuffer();

  private disconnectedState = false;

  private readonly pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  private readonly server = new Server(
    { name: 'arcnexus', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  /** Executes this lifecycle through its configured collaborators and propagates failures. */
  async run(): Promise<void> {
    this.socket.on('data', (data) => this.receive(data));
    this.socket.on('error', () => this.disconnected());
    this.socket.on('close', () => this.disconnected());
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: (await this.request('list')) as BridgeTool[],
    }));
    this.server.setRequestHandler(CallToolRequestSchema, async (req) =>
      this.call(req.params.name, req.params.arguments),
    );
    await this.server.connect(new StdioServerTransport());
    process.stdin.on('end', () => {
      this.socket.end();
      void this.server.close();
    });
  }

  /** Sends one correlated request, rejecting immediately after the parent disconnects. */
  private request(method: string, name?: string, args?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (this.disconnectedState) {
        reject(new Error('ArcNexus host disconnected'));
        return;
      }

      const id = ++this.sequence;
      this.pending.set(id, { resolve, reject });
      this.socket.write(JSON.stringify({ id, method, name, args }) + '\n');
    });
  }

  /** Sends complete UTF-8 response frames to the correlated request handler. */
  private receive(data: Buffer): void {
    for (const line of this.input.receive(data)) this.message(line);
  }

  /** Resolves or rejects the pending call associated with one received response. */
  private message(line: string): void {
    try {
      const message = JSON.parse(line);
      const waiting = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) waiting?.reject(new Error(message.error));
      else waiting?.resolve(message.result);
    } catch {
      this.socket.destroy();
    }
  }

  /** Rejects all pending requests once when the parent connection is lost. */
  private disconnected(): void {
    if (this.disconnectedState) return;
    this.disconnectedState = true;
    for (const pending of this.pending.values())
      pending.reject(new Error('ArcNexus host disconnected'));
    this.pending.clear();
    process.exitCode = 1;
    void this.server.close();
    process.stdin.destroy();
  }

  /** Invokes the named host capability through the constrained bridge protocol. */
  private async call(name: string, args: unknown) {
    try {
      const result = await this.request('call', name, args);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: String(error) }] };
    }
  }
}

await new BridgeClient().run();
