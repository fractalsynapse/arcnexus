import type { TimelineChanges } from '../../../packages/coordination/src/index.js';
import type { Context } from 'cordis';
import { ZodError } from 'zod';
import type { Data, DataScope, ResolveDataScope } from '../../../packages/data/src/index.js';
import { matchPlatform, platformRequest } from './platform-routes.js';
import { openApi } from './openapi.js';
import { matchRoute, routeInput } from './routes.js';
import { scopedEventStream, acceptsEvents } from './scoped-event-stream.js';
import { streamTimeline } from './timeline-stream.js';

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

type LiveResources = { timeline?: TimelineChanges; commands?: TimelineChanges };

function handler(data: Data, authenticate: AuthenticateRequest, live: LiveResources) {
  return async (request: Request) => {
    const url = new URL(request.url);
    const projectRoute = /^\/projects\/([^/]+)(\/.*)$/.exec(url.pathname);
    const platform = matchPlatform(request.method, url.pathname);
    if (!platform && !projectRoute) return problem(404, 'Resource unavailable');
    try {
      const project = platform ? 'platform' : decodeURIComponent(projectRoute![1]!);
      const scope = await authenticate(request, project);
      if (!scope || scope.project !== project) return problem(401, 'Project access unavailable');
      if (platform) return await platformRequest(data, scope, request, platform);
      return await projectResource(data, request, scope, projectRoute![2]!, url, live);
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
  live: LiveResources,
) {
  if (path === '/openapi.json' && request.method === 'GET')
    return Response.json(await openApi(data, scope));
  const match = matchRoute(path, request.method);
  if (!match)
    return matchRoute(path)
      ? problem(405, 'Method unavailable')
      : problem(404, 'Resource unavailable');
  const input = routeInput(match, url);
  if (match.route.stream && acceptsEvents(request))
    return projectStream(data, scope, request, match.route.stream, input, live);
  return invokeResource(data, scope, request, match.route, input);
}

async function projectStream(
  data: Data,
  scope: DataScope,
  request: Request,
  kind: keyof LiveResources,
  input: Record<string, unknown>,
  live: LiveResources,
) {
  const changes = live[kind];
  if (!changes) return problem(406, 'Live resource unavailable');
  if (kind === 'timeline') return streamTimeline(data, scope, input, request, changes);
  return scopedEventStream(request, scope, changes, async () => {
    const result = await data.invoke(scope, 'workflow-requests', 'current', input);
    return 'event: command\ndata: ' + JSON.stringify(result) + '\n\n';
  });
}

async function invokeResource(
  data: Data,
  scope: DataScope,
  request: Request,
  route: NonNullable<ReturnType<typeof matchRoute>>['route'],
  input: Record<string, unknown>,
) {
  const { resource, operation } = route;
  const content = route.method === 'POST' ? await request.text() : '';
  const body: unknown = content ? JSON.parse(content) : {};
  const value =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? { ...body, ...input }
      : body;
  const result = await data.invoke(scope, resource, operation, value);
  return Response.json(result, { status: route.method === 'POST' ? 202 : 200 });
}

export function apiPlugin(
  authenticate: AuthenticateRequest,
  timeline?: TimelineChanges,
  commands?: TimelineChanges,
) {
  return {
    inject: ['data'],
    /** Provide the API transport to a trusted composition. */
    apply(context: Context) {
      context.provide('api', handler(context.data, authenticate, { timeline, commands }));
    },
  };
}

export { serveApi } from './serve.js';
export { capacityApiPlugin } from './capacity.js';
