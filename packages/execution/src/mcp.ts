import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import type { AgentInspection } from '../../architecture/src/index.js';

type Binding = AgentInspection['request']['options']['tools'][number];
type Arguments = Record<string, unknown>;

/** Expose only the tool bindings captured for one native activation. */
export class LocalMcp {
  private readonly validator = new AjvJsonSchemaValidator();
  private readonly path = `/${randomUUID()}`;
  private readonly listener = createServer(
    (request, response) => void this.serve(request, response),
  );
  private readonly bindings;
  private pending: Promise<unknown> = Promise.resolve();

  /** Compile the captured argument constraints before accepting any request. */
  constructor(
    tools: readonly Binding[],
    private readonly invoke: (tool: Binding, args: Arguments) => Promise<unknown>,
    private readonly observe: (name: string, error?: string) => void,
  ) {
    this.bindings = new Map(
      tools.map((tool) => [
        tool.name,
        {
          tool,
          validate: this.validator.getValidator<Arguments>(tool.inputSchema),
        },
      ]),
    );
  }

  /** Bind to an ephemeral loopback endpoint owned by this activation. */
  async start() {
    await new Promise<void>((resolve, reject) => {
      this.listener.once('error', reject);
      this.listener.listen(0, '127.0.0.1', () => {
        this.listener.off('error', reject);
        resolve();
      });
    });
    const address = this.listener.address();
    if (!address || typeof address === 'string') throw new Error('No local MCP endpoint');
    return `http://127.0.0.1:${address.port}${this.path}`;
  }

  /** Stop accepting calls and wait for effects already in flight. */
  async close() {
    this.listener.close();
    this.listener.closeAllConnections();
    await this.pending;
  }

  /** Serve one MCP exchange with no discoverable endpoint or remote origin. */
  private async serve(request: IncomingMessage, response: ServerResponse) {
    const address = this.listener.address();
    const host = address && typeof address !== 'string' ? `127.0.0.1:${address.port}` : '';
    if (request.url !== this.path || request.headers.host !== host || request.headers.origin) {
      response.writeHead(404).end();
      return;
    }
    const server = new Server({ name: 'arcnexus', version: '1' }, { capabilities: { tools: {} } });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: [...this.bindings.values()].map(({ tool: { handler: _handler, ...tool } }) => tool),
    }));
    server.setRequestHandler(CallToolRequestSchema, ({ params }) => {
      const result = this.pending.then(() => this.call(params.name, params.arguments ?? {}));
      this.pending = result.catch(() => {});
      return result;
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response);
    } catch {
      if (!response.headersSent) response.writeHead(500).end();
    } finally {
      await server.close();
    }
  }

  /** Refuse unmapped tools and invalid input before dispatch and retain their diagnostics. */
  private async call(name: string, args: Arguments) {
    try {
      const binding = this.bindings.get(name);
      if (!binding) throw new Error(`Operation ${name} is not mapped to this activity`);
      const validation = binding.validate(args);
      if (!validation.valid) throw new Error(validation.errorMessage);
      const result = await this.invoke(binding.tool, validation.data);
      this.observe(name);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.observe(name, reason);
      return { isError: true, content: [{ type: 'text' as const, text: reason }] };
    }
  }
}
