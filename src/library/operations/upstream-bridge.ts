import { createHash } from 'node:crypto';
import type { BridgeTool } from '../steward/bridge.js';
import type { UpstreamExecution } from './upstream-execution.js';
import type { RepositoryDocuments } from './repository-documents.js';

/** Exposes collaboration intent through the existing MCP bridge without accepting worker authority. */
export class UpstreamBridge {
  readonly tools: BridgeTool[];

  /** Captures host identity, destination and allowed tools for one assignment connection. */
  constructor(
    private readonly executor: UpstreamExecution,
    private readonly target: string,
    private readonly assignmentScope: string,
    private readonly signal: AbortSignal,
    available: Array<'issue.create' | 'issue.comment'>,
    private readonly documents?: RepositoryDocuments,
  ) {
    this.tools = [...new Set(available)].map((operation) => this.tool(operation));
  }

  /** Validates complete input and derives a durable identity scoped by the trusted host connection. */
  async call(name: string, args: unknown): Promise<unknown> {
    const tool = this.tools.find((entry) => entry.name === name);
    if (!tool) throw new Error('Collaboration operation is unavailable');
    if (!args || typeof args !== 'object' || Array.isArray(args))
      throw new Error('Expected collaboration intent object');
    const input = args as Record<string, unknown>;
    const allowed = name === 'issue.create' ? ['key', 'title', 'body'] : ['key', 'issueId', 'body'];
    if (Object.keys(input).some((key) => !allowed.includes(key)))
      throw new Error('Unexpected collaboration field; identity and destination are host-bound');
    for (const field of allowed)
      if (input[field] === undefined) throw new Error('Missing collaboration field: ' + field);
    if (typeof input.key !== 'string' || !input.key.trim()) throw new Error('Expected retry key');
    if (name === 'issue.create') this.documents?.validateIssue(input.body);
    const id = createHash('sha256')
      .update(JSON.stringify([this.assignmentScope, name, input.key]))
      .digest('hex');
    const { key: _key, ...content } = input;
    return this.executor.execute(id, name, this.target, content, this.signal);
  }

  /** Advertises intent fields only; retries must preserve the key and complete input. */
  private tool(operation: 'issue.create' | 'issue.comment'): BridgeTool {
    const fields =
      operation === 'issue.create'
        ? { title: { type: 'string', minLength: 1 } }
        : { issueId: { type: ['string', 'integer'] } };
    return {
      name: operation,
      description:
        'Use readable Markdown and the repository issue template sections for new issues. Reuse the same key only for an identical retry.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          key: { type: 'string', minLength: 1 },
          body: { type: 'string', minLength: 1 },
          ...fields,
        },
        required: ['key', 'body', ...Object.keys(fields)],
      },
    };
  }
}
