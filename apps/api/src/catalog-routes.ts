import type { Data, DataScope } from '../../../packages/data/src/index.js';

export const catalogRoutes = [
  { method: 'GET', path: '/projects', operation: 'list', status: 200 },
  { method: 'POST', path: '/projects', operation: 'create', status: 201 },
  { method: 'GET', path: '/projects/{id}', operation: 'read', status: 200 },
  { method: 'GET', path: '/projects/{id}/reachability', operation: 'probe', status: 200 },
  { method: 'PATCH', path: '/projects/{id}', operation: 'update', status: 200 },
  { method: 'DELETE', path: '/projects/{id}', operation: 'delete', status: 200 },
] as const;

export function matchCatalog(method: string, path: string) {
  const id = /^\/projects\/([^/]+)(?:\/reachability)?$/.exec(path)?.[1];
  const route = catalogRoutes.find(
    (candidate) =>
      candidate.method === method &&
      (candidate.path === path || (id && candidate.path.replace('{id}', id) === path)),
  );
  return route && { route, id };
}

export async function catalogRequest(
  data: Data,
  scope: DataScope,
  request: Request,
  { route, id }: NonNullable<ReturnType<typeof matchCatalog>>,
) {
  const input = await catalogInput(route.operation, request, id);
  const output = await data.invoke(scope, 'projects', route.operation, input);
  return Response.json(output, { status: route.status });
}

async function catalogInput(operation: string, request: Request, id?: string) {
  if (operation === 'create') return request.json();
  if (operation === 'update') {
    const expectedRevision = /^"([^"]+)"$/.exec(request.headers.get('if-match') ?? '')?.[1];
    return { id, expectedRevision };
  }
  return id ? { id } : {};
}

/** Describe each authorized catalog handler using its registered Data schema. */
export async function catalogPaths(data: Data, scope: DataScope) {
  const definitions = await data.describe(scope);
  const paths: Record<string, Record<string, object>> = {};
  for (const { method, path, operation, status } of catalogRoutes) {
    const definition = definitions.find(
      (item) => item.resource === 'projects' && item.operation === operation,
    );
    if (!definition) continue;
    const spec = catalogOperation(operation, status, definition);
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

function catalogOperation(
  operation: string,
  status: number,
  definition: { input: object; output: object },
) {
  const spec = {
    operationId: 'projects.' + operation,
    responses: {
      [status]: {
        description: 'Scoped catalog record',
        content: { 'application/json': { schema: definition.output } },
      },
    },
  };
  if (operation === 'create')
    return {
      ...spec,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: definition.input } },
      },
    };
  if (operation === 'update') return { ...spec, parameters: [projectId, expectedRevision] };
  if (operation === 'delete' || operation === 'read' || operation === 'probe')
    return { ...spec, parameters: [projectId] };
  return spec;
}
