import { catalogPaths } from './catalog-routes.js';
import type { Data, DataScope } from '../../../packages/data/src/index.js';
import { routes } from './routes.js';

const string = { type: 'string' } as const;

function parametersFor(route: (typeof routes)[number]) {
  const parameters = [{ name: 'project', in: 'path', required: true, schema: string }];
  if (route.parameter)
    parameters.push({ name: route.parameter, in: 'path', required: true, schema: string });
  for (const name of route.cursor ? ['after', 'through'] : (route.query ?? ['revision']))
    parameters.push({ name, in: 'query', required: Boolean(route.query), schema: string });
  return parameters;
}

/** Use the owner output schemas and the exact scoped REST paths. */
export async function openApi(data: Data, scope: DataScope) {
  if (scope.project === 'platform') return document(await catalogPaths(data, scope));
  const operations = await data.describe(scope);
  const paths = Object.fromEntries(
    routes.flatMap((route) => {
      const definition = operations.find(
        ({ resource, operation }) => resource === route.resource && operation === route.operation,
      );
      if (!definition) return [];
      return [
        [
          '/projects/{project}' + route.path,
          {
            get: {
              operationId: route.resource + '.' + route.operation,
              parameters: parametersFor(route),
              responses: {
                '200': {
                  description: 'Scoped data',
                  content: { 'application/json': { schema: definition.output } },
                },
              },
            },
          },
        ],
      ];
    }),
  );
  return document(paths);
}

function document(paths: object) {
  return { openapi: '3.1.0', info: { title: 'ArcNexus', version: '0.3.0' }, paths };
}
