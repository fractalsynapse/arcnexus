import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { DataScope, ResolveDataScope } from '../../../packages/data/src/index.js';

/** Authenticate every MCP request and compose a stateless scoped protocol transport. */
export function operatorMcpHttp(
  server: (scope: DataScope) => Server,
  authenticate: ResolveDataScope<Request>,
) {
  return async (request: Request) => {
    const match = /^\/projects\/([^/]+)\/mcp$/.exec(new URL(request.url).pathname);
    if (!match) return new Response(null, { status: 404 });
    let project: string;
    try {
      project = decodeURIComponent(match[1]!);
    } catch {
      return new Response(null, { status: 400 });
    }
    const scope = await authenticate(request, project);
    if (!scope || scope.project !== project) return new Response(null, { status: 401 });
    const endpoint = server(scope);
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    try {
      await endpoint.connect(transport);
      return await transport.handleRequest(request);
    } finally {
      await endpoint.close();
    }
  };
}
