import type { Context } from 'cordis';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import type { Data, DataScope } from '../../../packages/data/src/index.js';

const tools = {
  submit_workflow: {
    resource: 'workflow-requests',
    operation: 'create',
    description: 'Submit an authorized Plan, Run, Architect, or Refine request.',
  },
  current_workflow: {
    resource: 'workflow-requests',
    operation: 'current',
    description: 'Find your active workflow or most recent retained command receipt.',
  },
  read_workflow: {
    resource: 'workflow-requests',
    operation: 'read',
    description: 'Read the current state and execution identity of your submitted request.',
  },
  cancel_workflow: {
    resource: 'workflow-requests',
    operation: 'cancel',
    description: 'Cancel your submitted workflow.',
  },
  answer_workflow: {
    resource: 'workflow-requests',
    operation: 'answer',
    description: 'Answer the exact open question for your workflow request.',
  },

  list_projects: {
    resource: 'projects',
    operation: 'list',
    description: 'List selectable projects.',
  },
  read_project: {
    resource: 'projects',
    operation: 'read',
    description: 'Read a verified project binding.',
  },
  import_project: {
    resource: 'projects',
    operation: 'create',
    description: 'Import an authorized project.',
  },
  refresh_project: {
    resource: 'projects',
    operation: 'update',
    description: 'Verify and refresh a project at its expected revision.',
  },
  retire_project: {
    resource: 'projects',
    operation: 'delete',
    description: 'Retire a project selection.',
  },
  inspect: {
    resource: 'agent-inspection',
    operation: 'read',
    description:
      'Inspect the exact Agent prompt and allowed operations at the pinned project revision.',
  },
  list_goals: {
    resource: 'goals',
    operation: 'list',
    description: 'List standing goals at an approved project revision.',
  },
  read_goal: {
    resource: 'goals',
    operation: 'read',
    description: 'Read a standing goal at an approved project revision.',
  },
  list_objectives: {
    resource: 'objectives',
    operation: 'list',
    description: 'List objective records at an approved project revision.',
  },
  read_objective: {
    resource: 'objectives',
    operation: 'read',
    description: 'Read an objective record at an approved project revision.',
  },
  read_current_plan: {
    resource: 'plan-executions',
    operation: 'current',
    description: 'Read the latest retained Plan execution reference.',
  },
  read_plan_outcome: {
    resource: 'plan-executions',
    operation: 'outcome',
    description: 'Read the recorded outcome for a pinned Plan execution.',
  },
  read_plan_metrics: {
    resource: 'plan-executions',
    operation: 'metrics',
    description: 'Read measured elapsed time and token usage for a pinned Plan.',
  },
  read_plan_tool_counts: {
    resource: 'plan-executions',
    operation: 'tool-counts',
    description: 'Read observed tool frequency for a pinned Plan execution.',
  },
  read_operation_evidence: {
    resource: 'operation-evidence',
    operation: 'read',
    description: 'Read recorded complete tool inputs and outputs for a selected timeline event.',
  },
  read_execution_timeline: {
    resource: 'execution-events',
    operation: 'read',
    description: 'Replay retained execution events after a scoped cursor.',
  },
} as const;

declare module 'cordis' {
  interface Context {
    operatorMcp: (scope: DataScope) => Server;
  }
}

/** Publish only the Data operations available to the authenticated session. */
async function list(data: Data, scope: DataScope) {
  const descriptions = await data.describe(scope);
  return Object.entries(tools).flatMap(([name, tool]) => {
    const definition = descriptions.find(
      ({ resource, operation }) => tool.resource === resource && tool.operation === operation,
    );
    if (!definition) return [];
    return [
      {
        name,
        description: tool.description,
        inputSchema: { ...definition.input, type: 'object' as const },
        outputSchema: { ...definition.output, type: 'object' as const },
      },
    ];
  });
}

async function call(data: Data, scope: DataScope, params: CallToolRequest['params']) {
  const tool = Object.hasOwn(tools, params.name)
    ? tools[params.name as keyof typeof tools]
    : undefined;
  if (!tool)
    return { isError: true, content: [{ type: 'text' as const, text: 'Tool unavailable.' }] };
  try {
    const result = await data.invoke(scope, tool.resource, tool.operation, params.arguments ?? {});
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      structuredContent: result as Record<string, unknown>,
    };
  } catch {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: 'Requested project data is unavailable.' }],
    };
  }
}

/** Compose an operator MCP protocol endpoint for one verified project. */
function server(data: Data, scope: DataScope) {
  const endpoint = new Server(
    { name: 'arcnexus-operator', version: '0.3.0' },
    { capabilities: { tools: {} } },
  );
  endpoint.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: await list(data, scope),
  }));
  endpoint.setRequestHandler(CallToolRequestSchema, ({ params }) => call(data, scope, params));
  return endpoint;
}

export const operatorMcpPlugin = {
  inject: ['data'],
  /** Bind sessions to the same Data service as the REST adapter. */
  apply(context: Context) {
    context.provide('operatorMcp', (scope: DataScope) => server(context.data, scope));
  },
};

export { operatorMcpHttp } from './http.js';
