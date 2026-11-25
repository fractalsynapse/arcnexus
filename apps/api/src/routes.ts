type Route = {
  path: string;
  resource: string;
  operation: string;
  method?: 'POST';
  parameter?: string;
  stream?: 'timeline' | 'commands';
  query?: readonly string[];
};

export const routes: readonly Route[] = [
  {
    path: '/operation-evidence/{sequence}',
    resource: 'operation-evidence',
    operation: 'read',
    parameter: 'sequence',
    query: ['execution'],
  },

  {
    method: 'POST',
    path: '/commands',
    resource: 'workflow-requests',
    operation: 'create',
    query: [],
  },
  {
    path: '/commands/current',
    resource: 'workflow-requests',
    operation: 'current',
    query: [],
    stream: 'commands',
  },
  {
    path: '/commands/{id}',
    resource: 'workflow-requests',
    operation: 'read',
    parameter: 'id',
    query: [],
  },
  {
    method: 'POST',
    path: '/commands/{id}/cancel',
    resource: 'workflow-requests',
    operation: 'cancel',
    parameter: 'id',
    query: [],
  },
  {
    method: 'POST',
    path: '/commands/{id}/answer',
    resource: 'workflow-requests',
    operation: 'answer',
    parameter: 'id',
    query: [],
  },

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
    stream: 'timeline',
  },
  {
    path: '/inspection',
    resource: 'agent-inspection',
    operation: 'read',
    query: ['component', 'activity'],
  },

  ...['goals', 'objectives'].flatMap((resource) => guideRoutes(resource)),
  {
    path: '/executions/{execution}/events',
    resource: 'execution-events',
    operation: 'read',
    parameter: 'execution',
    stream: 'timeline',
  },
];

function guideRoutes(resource: string): Route[] {
  const path = '/' + resource;
  const detail = { resource, parameter: 'id' };
  return [
    { path, resource, operation: 'list', query: ['revision', 'search'] },
    { ...detail, path: path + '/{id}', operation: 'read', query: ['revision', 'fileRevision'] },
    { ...detail, path: path + '/{id}/revisions', operation: 'revisions' },
    {
      ...detail,
      path: path + '/{id}/changes',
      operation: 'changes',
      query: ['revision', 'fileRevision'],
    },
  ];
}

export function matchRoute(path: string, method?: string) {
  for (const route of routes) {
    if (method && (route.method ?? 'GET') !== method) continue;
    const pattern = new RegExp('^' + route.path.replace(/\{\w+\}/, '([^/]+)') + '$');
    const match = pattern.exec(path);
    if (match) return { route, binding: match[1] };
  }
}

export function routeInput(match: NonNullable<ReturnType<typeof matchRoute>>, url: URL) {
  const { route, binding } = match;
  const input: Record<string, unknown> = {};
  if (route.parameter && binding) input[route.parameter] = decodeURIComponent(binding);
  if (route.stream === 'timeline') {
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
