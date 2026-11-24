import { catalogPaths } from './catalog-routes.js';
import type { Data, DataScope } from '../../../packages/data/src/index.js';
import { routes } from './routes.js';

const string = { type: 'string' } as const;
type Route = (typeof routes)[number];
type Definition = Awaited<ReturnType<Data['describe']>>[number];

function parametersFor(route: Route) {
  const parameters = [{ name: 'project', in: 'path', required: true, schema: string }];
  if (route.parameter)
    parameters.push({ name: route.parameter, in: 'path', required: true, schema: string });
  for (const name of route.stream === 'timeline'
    ? ['after', 'through']
    : (route.query ?? ['revision']))
    parameters.push({ name, in: 'query', required: Boolean(route.query), schema: string });
  return parameters;
}

/** Use authorization and schemas from the Data registration for each scoped REST operation. */
export async function openApi(data: Data, scope: DataScope) {
  if (scope.project === 'platform') return document(await catalogPaths(data, scope));
  const operations = await data.describe(scope);
  const paths: Record<string, Record<string, object>> = {};
  for (const route of routes) {
    const definition = operations.find(
      ({ resource, operation }) => resource === route.resource && operation === route.operation,
    );
    if (!definition) continue;
    const methods = (paths['/projects/{project}' + route.path] ??= {});
    methods[route.method?.toLowerCase() ?? 'get'] = projectOperation(route, definition);
  }
  return document(paths);
}

function projectOperation(route: Route, definition: Definition) {
  const body = route.method && requestSchema(route, definition.input);
  return {
    operationId: route.resource + '.' + route.operation,
    parameters: parametersFor(route),
    ...(body && {
      requestBody: { required: true, content: { 'application/json': { schema: body } } },
    }),
    responses: {
      [route.method ? 202 : 200]: {
        description: route.method ? 'Accepted workflow request' : 'Scoped data',
        content: {
          'application/json': { schema: definition.output },
          ...(route.stream && { 'text/event-stream': { schema: string } }),
        },
      },
    },
  };
}

function requestSchema(
  route: Route,
  input: { properties?: Record<string, unknown>; required?: readonly string[] },
) {
  const propertyNames = Object.keys(input.properties ?? {}).filter(
    (key) => key !== route.parameter,
  );
  if (!propertyNames.length) return;
  const properties = Object.fromEntries(propertyNames.map((key) => [key, input.properties?.[key]]));
  return {
    ...input,
    properties,
    required: input.required?.filter((key) => key !== route.parameter),
  };
}

function document(paths: object) {
  return { openapi: '3.1.0', info: { title: 'ArcNexus', version: '0.3.0' }, paths };
}
