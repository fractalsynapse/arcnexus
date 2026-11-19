const string = { type: 'string' } as const;
const nullable = { type: ['string', 'null'] } as const;

/** Keep the advertised and enforced tool shapes at one source. */
function tool(description: string, properties: Record<string, object>, required: string[] = []) {
  return {
    description,
    inputSchema: { type: 'object' as const, properties, required, additionalProperties: false },
  };
}

const definitions = {
  read: tool(
    'Read a project file or retained evidence. Returns literal source below a path/hash/range header and exact path, sha256, text and nextOffset structured fields. Use source text as written, without adding JSON escaping.',
    {
      path: string,
      offset: { type: 'integer', minimum: 0 },
    },
    ['path'],
  ),
  list: tool('List one project directory. Use . for the project root.', { path: string }, ['path']),
  edit: tool(
    'Apply and retain a checked edit to exactly one owned file. To replace a whole file supply path, expected current hash and actual replacement content; omit transform. Use null expected for creation and null content for deletion. A literal transform.replace needs one nonempty unique before anchor and its after text; empty anchors are refused. Source content must not acquire extra JSON escaping.',
    {
      path: string,
      expected: nullable,
      content: nullable,
      transform: {
        type: 'object',
        additionalProperties: false,
        properties: {
          format: { type: 'boolean' },
          replace: {
            type: 'object',
            additionalProperties: false,
            required: ['before', 'after'],
            properties: { before: string, after: string },
          },
        },
      },
    },
    ['path', 'expected'],
  ),
  archive: tool(
    'Archive one retained reusable research report owned by this component.',
    { id: string },
    ['id'],
  ),
  question: tool(
    'Open a human clarification gate. End the current response after the request is recorded. The host resumes this activity with the recorded answer.',
    { question: string },
    ['question'],
  ),
  research: tool(
    'Request optional research for a decision and end the current response. The host resumes this activity with the report.',
    { question: string, decision: string },
    ['question', 'decision'],
  ),
  supplier: tool(
    'Request an owning component contribution through Direction and end the current response. Link an existing supplier milestone when known.',
    { owner: string, milestone: string, reason: string, question: string },
    ['owner', 'milestone', 'reason'],
  ),
  check: tool(
    'Request this captured check against the current steward work and declare whether it should pass or fail. The host retains the exact exit status and log.',
    { expected: { type: 'string', enum: ['pass', 'fail'] } },
    ['expected'],
  ),
};

export type OperationHandler = keyof typeof definitions;

/** Bind a captured operation ID to a known local handler and its exact input shape. */
export function operationTool(name: string, handler: string) {
  if (!Object.hasOwn(definitions, handler))
    throw new Error(`Unknown MCP handler ${handler} for ${name}`);
  return {
    name,
    handler: handler as OperationHandler,
    ...definitions[handler as OperationHandler],
  };
}
