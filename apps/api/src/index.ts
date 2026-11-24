import type { TimelineChanges } from '../../../packages/coordination/src/index.js';
import type { Context } from 'cordis';
import { ZodError } from 'zod';
import type { Data, ResolveDataScope } from '../../../packages/data/src/index.js';
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

/** Serve authorized REST reads with one project scope and the owner-defined Data operation. */
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
      if (request.method !== 'GET') return problem(405, 'Method unavailable');
      if (projectRoute![2] === '/openapi.json') return Response.json(await openApi(data, scope));
      const match = matchRoute(projectRoute![2]!);
      if (!match) return problem(404, 'Resource unavailable');
      const { resource, operation } = match.route;
      const input = routeInput(match, url);
      if (match.route.cursor && acceptsTimeline(request))
        return changes
          ? await streamTimeline(data, scope, input, request, changes)
          : problem(406, 'Live timeline unavailable');
      const result = await data.invoke(scope, resource, operation, input);
      return Response.json(result);
    } catch (error) {
      return apiError(error);
    }
  };
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
