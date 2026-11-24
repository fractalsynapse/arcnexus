import type { TimelineChanges } from '../../../packages/coordination/src/index.js';
import type { Context } from 'cordis';
import { ZodError } from 'zod';
import type { Data, DataScope, ResolveDataScope } from '../../../packages/data/src/index.js';
import { catalogRequest, matchCatalog } from './catalog-routes.js';
import { openApi } from './openapi.js';
import { matchRoute, routeInput } from './routes.js';
import { acceptsTimeline, streamTimeline } from './timeline-stream.js';

export type AuthenticateRequest = ResolveDataScope<Request>;

declare module 'cordis' {
  interface Context {
    api: (request: Request) => Promise<Response>;
  }
}

function problem(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

function apiError(error: unknown) {
  if (error instanceof URIError || error instanceof SyntaxError || error instanceof ZodError)
    return problem(400, 'Invalid resource request');
  if (error instanceof Error && error.message === 'Data operation not authorized')
    return problem(403, 'Operation unavailable');
  return problem(409, 'Requested project data is unavailable');
}

/** Serve authorized REST operations with one project scope and the owner-defined Data operation. */
function handler(data: Data, authenticate: AuthenticateRequest, changes?: TimelineChanges) {
  return async (request: Request) => {
    const url = new URL(request.url);
    const projectRoute = /^\/projects\/([^/]+)(\/.*)$/.exec(url.pathname);
    const catalog = matchCatalog(request.method, url.pathname);
    if (!catalog && !projectRoute) return problem(404, 'Resource unavailable');
    try {
      const project = catalog ? 'platform' : decodeURIComponent(projectRoute![1]!);
      const scope = await authenticate(request, project);
      if (!scope || scope.project !== project) return problem(401, 'Project access unavailable');
      if (catalog) return await catalogRequest(data, scope, request, catalog);
      return await projectResource(data, request, scope, projectRoute![2]!, url, changes);
    } catch (error) {
      return apiError(error);
    }
  };
}

async function projectResource(
  data: Data,
  request: Request,
  scope: DataScope,
  path: string,
  url: URL,
  changes?: TimelineChanges,
) {
  if (path === '/openapi.json' && request.method === 'GET')
    return Response.json(await openApi(data, scope));
  const match = matchRoute(path, request.method);
  if (!match)
    return matchRoute(path)
      ? problem(405, 'Method unavailable')
      : problem(404, 'Resource unavailable');
  const { resource, operation } = match.route;
  const input = routeInput(match, url);
  if (match.route.cursor && acceptsTimeline(request))
    return changes
      ? await streamTimeline(data, scope, input, request, changes)
      : problem(406, 'Live timeline unavailable');
  const content = match.route.method === 'POST' ? await request.text() : '';
  const body: unknown = content ? JSON.parse(content) : {};
  const value =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? { ...body, ...input }
      : body;
  const result = await data.invoke(scope, resource, operation, value);
  return Response.json(result, { status: match.route.method === 'POST' ? 202 : 200 });
}

export function apiPlugin(authenticate: AuthenticateRequest, changes?: TimelineChanges) {
  return {
    inject: ['data'],
    /** Provide the API transport to a trusted composition. */
    apply(context: Context) {
      context.provide('api', handler(context.data, authenticate, changes));
    },
  };
}

export { serveApi } from './serve.js';
export { capacityApiPlugin } from './capacity.js';
