import type { Data, DataScope } from '../../../packages/data/src/index.js';
import { uiPreferencesResource } from '../../../packages/ui/src/preferences/schema.js';

const catalogRoutes = [
  { method: 'GET', path: '/projects', operation: 'list', status: 200 },
  { method: 'POST', path: '/projects', operation: 'create', status: 201 },
  { method: 'GET', path: '/projects/{id}', operation: 'read', status: 200 },
  { method: 'GET', path: '/projects/{id}/reachability', operation: 'probe', status: 200 },
  { method: 'PATCH', path: '/projects/{id}', operation: 'update', status: 200 },
  { method: 'DELETE', path: '/projects/{id}', operation: 'delete', status: 200 },
] as const;

const preferencesPath = '/' + uiPreferencesResource;
const platformRoutes = [
  ...catalogRoutes.map((route) => ({ ...route, resource: 'projects' as const })),
  {
    method: 'GET',
    path: preferencesPath,
    operation: 'read',
    status: 200,
    resource: uiPreferencesResource,
  },
  {
    method: 'PATCH',
    path: preferencesPath,
    operation: 'update',
    status: 200,
    resource: uiPreferencesResource,
  },
] as const;

type PlatformRoute = (typeof platformRoutes)[number];

export function matchPlatform(method: string, path: string) {
  const id = /^\/projects\/([^/]+)(?:\/reachability)?$/.exec(path)?.[1];
  const route = platformRoutes.find(
    (candidate) =>
      candidate.method === method &&
      (candidate.path === path || (id && candidate.path.replace('{id}', id) === path)),
  );
  return route && { route, id };
}

export async function platformRequest(
  data: Data,
  scope: DataScope,
  request: Request,
  { route, id }: NonNullable<ReturnType<typeof matchPlatform>>,
) {
  const input = await platformInput(route, request, id);
  const output = await data.invoke(scope, route.resource, route.operation, input);
  return Response.json(output, { status: route.status, headers: { 'Cache-Control': 'no-store' } });
}

function hasBody(route: PlatformRoute) {
  return (
    route.operation === 'create' ||
    (route.resource === uiPreferencesResource && route.operation === 'update')
  );
}

async function platformInput(route: PlatformRoute, request: Request, id?: string) {
  if (hasBody(route)) return request.json();
  if (route.operation === 'update') {
    const expectedRevision = /^"([^"]+)"$/.exec(request.headers.get('if-match') ?? '')?.[1];
    return { id, expectedRevision };
  }
  return id ? { id } : {};
}

/** Describe each platform handler using its authorized Data schema. */
export async function platformPaths(data: Data, scope: DataScope) {
  const definitions = await data.describe(scope);
  const paths: Record<string, Record<string, object>> = {};
  for (const route of platformRoutes) {
    const { method, path, operation, resource } = route;
    const definition = definitions.find(
      (item) => item.resource === resource && item.operation === operation,
    );
    if (!definition) continue;
    const spec = platformOperation(route, definition);
    (paths[path] ??= {})[method.toLowerCase()] = spec;
  }
  return paths;
}

const projectId = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

const expectedRevision = {
  name: 'If-Match',
  in: 'header',
  required: true,
  schema: { type: 'string' },
};

function platformOperation(route: PlatformRoute, definition: { input: object; output: object }) {
  const { operation, resource, status } = route;
  const spec = {
    operationId: resource + '.' + operation,
    responses: {
      [status]: {
        description: 'Operator-scoped data',
        content: { 'application/json': { schema: definition.output } },
      },
    },
  };
  if (hasBody(route))
    return {
      ...spec,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: definition.input } },
      },
    };
  if (resource !== 'projects') return spec;
  if (operation === 'update') return { ...spec, parameters: [projectId, expectedRevision] };
  if (route.path.includes('{id}')) return { ...spec, parameters: [projectId] };
  return spec;
}
