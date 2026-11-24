type Route = {
  path: string;
  resource: string;
  operation: string;
  parameter?: string;
  cursor?: boolean;
  query?: readonly string[];
};

export const routes: readonly Route[] = [
  {
    path: '/plan-executions/current',
    resource: 'plan-executions',
    operation: 'current',
    query: [],
  },
  ...['outcome', 'metrics', 'tool-counts'].map((operation) => ({
    path: '/plan-executions/{execution}/' + operation,
    resource: 'plan-executions',
    operation,
    parameter: 'execution',
    query: [],
  })),
  {
    path: '/plan-executions/{execution}/events',
    resource: 'execution-events',
    operation: 'read',
    parameter: 'execution',
    cursor: true,
  },
  {
    path: '/inspection',
    resource: 'agent-inspection',
    operation: 'read',
    query: ['component', 'activity'],
  },

  { path: '/goals', resource: 'goals', operation: 'list' },
  { path: '/goals/{id}', resource: 'goals', operation: 'read', parameter: 'id' },
  { path: '/objectives', resource: 'objectives', operation: 'list' },
  { path: '/objectives/{id}', resource: 'objectives', operation: 'read', parameter: 'id' },
  {
    path: '/executions/{execution}/events',
    resource: 'execution-events',
    operation: 'read',
    parameter: 'execution',
    cursor: true,
  },
];

export function matchRoute(path: string) {
  for (const route of routes) {
    const pattern = new RegExp('^' + route.path.replace(/\{\w+\}/, '([^/]+)') + '$');
    const match = pattern.exec(path);
    if (match) return { route, binding: match[1] };
  }
}

export function routeInput(match: NonNullable<ReturnType<typeof matchRoute>>, url: URL) {
  const { route, binding } = match;
  const input: Record<string, unknown> = {};
  if (route.parameter && binding) input[route.parameter] = decodeURIComponent(binding);
  if (route.cursor) {
    for (const key of ['after', 'through']) {
      const cursor = url.searchParams.get(key);
      if (cursor !== null)
        input[key] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    }
  } else {
    for (const key of route.query ?? ['revision']) {
      const value = url.searchParams.get(key);
      if (value !== null) input[key] = value;
    }
  }
  return input;
}
