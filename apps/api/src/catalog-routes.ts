import type { Data, DataScope } from '../../../packages/data/src/index.js';

export const catalogRoutes = [
  { method: 'GET', path: '/projects', operation: 'list', status: 200 },
  { method: 'POST', path: '/projects', operation: 'create', status: 201 },
  { method: 'DELETE', path: '/projects/{id}', operation: 'delete', status: 200 },
] as const;

export function matchCatalog(method: string, path: string) {
  const id = /^\/projects\/([^/]+)$/.exec(path)?.[1];
  const route = catalogRoutes.find(
    (candidate) =>
      candidate.method === method &&
      (candidate.path === path || (id && candidate.path === '/projects/{id}')),
  );
  return route && { route, id };
}

export async function catalogRequest(
  data: Data,
  scope: DataScope,
  request: Request,
  { route, id }: NonNullable<ReturnType<typeof matchCatalog>>,
) {
  const input: unknown = route.operation === 'create' ? await request.json() : id ? { id } : {};
  const output = await data.invoke(scope, 'projects', route.operation, input);
  return Response.json(output, { status: route.status });
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
  if (operation === 'delete') return { ...spec, parameters: [projectId] };
  return spec;
}
