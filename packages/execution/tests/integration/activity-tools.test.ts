import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import test from 'node:test';
import type { AgentInspection } from '../../../architecture/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import type { HostTask } from '../../src/index.js';
import { LocalMcp } from '../../src/mcp.js';
import { inboxIdentity } from '../../src/research.js';

type Binding = AgentInspection['request']['options']['tools'][number];

/** Test the wire boundary and refusal evidence with one captured, single-path operation. */
class ToolBoundary {
  private readonly calls: string[] = [];
  private readonly refusals: string[] = [];
  private readonly binding: Binding = {
    name: 'read-file',
    handler: 'read',
    description: 'Read a fixture',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
      additionalProperties: false,
    },
  };

  /** Check the exact tool list, one valid call and refusals before invocation. */
  async run() {
    const host = new LocalMcp(
      [this.binding],
      async (_tool, args) => {
        this.calls.push(String(args.path));
        return { contents: 'fixture' };
      },
      (_name, error) => {
        if (error) this.refusals.push(error);
      },
    );
    const client = new Client({ name: 'fixture', version: '1' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(await host.start())));
      await this.verifyCalls(client);
    } finally {
      await client.close();
      await host.close();
    }
  }

  /** Compare operation requests with the exact invocations and refusals. */
  private async verifyCalls(client: Client) {
    assert.deepEqual(
      (await client.listTools()).tools.map(({ name }) => name),
      ['read-file'],
    );
    const allowed = await client.callTool({ name: 'read-file', arguments: { path: 'one' } });
    assert(!allowed.isError);
    const forbidden = await client.callTool({ name: 'shell', arguments: { command: 'pwd' } });
    assert(forbidden.isError);
    const batch = await client.callTool({
      name: 'read-file',
      arguments: { path: 'one', paths: ['two'] },
    });
    assert(batch.isError);
    assert.deepEqual(this.calls, ['one']);
    assert.match(this.refusals[0] ?? '', /not mapped/);
    assert.equal(this.refusals.length, 2);
  }
}

test('local MCP exposes only the captured operation and refuses alternate actions', () =>
  new ToolBoundary().run());

/** Open one native testing activation without invoking external services. */
function testingActivation(retainedSelfLink = false) {
  const selection = { component: 'fixture', activity: 'testing' };
  const input = {
    goal: 'Verify a checkpoint',
    assignment: {},
    milestone: { id: 'current' },
    acceptance: [],
    worktree: '.',
  };
  const events: unknown[] = [];
  const task = {
    taskID: 'fixture',
    capture: { source: { revision: 'staging' }, project: {} },
    observations: () => events,
    note: (event: unknown) => events.push(event),
  } as unknown as HostTask;
  if (retainedSelfLink)
    events.push({
      projectRequest: {
        scope: inboxIdentity(task, selection, input),
        kind: 'supplier',
        owner: 'fixture',
        milestone: 'current',
        reason: 'Previously acknowledged self-link',
      },
    });
  return new ActivationTools(task, selection, input, new AbortController().signal);
}

test('local MCP returns the observed check before the caller continues', async () => {
  const events: unknown[] = [];
  const calls: string[] = [];
  const task = {
    taskID: 'fixture',
    capture: { source: { revision: 'staging' }, project: {} },
    observations: () => events,
    note: (event: unknown) => events.push(event),
    check: async (id: string) => {
      calls.push(id);
      return { id, status: 37, log: '/evidence/check.log' };
    },
  } as unknown as HostTask;
  const selection = { component: 'fixture', activity: 'testing' };
  const input = { goal: 'Check', assignment: {}, milestone: { id: 'current' }, acceptance: [], worktree: '.' };
  const activation = new ActivationTools(task, selection, input, new AbortController().signal);
  const binding: Binding = {
    name: 'owner-tests',
    handler: 'check',
    description: 'Run captured check',
    inputSchema: {
      type: 'object',
      properties: { expected: { type: 'string', enum: ['pass', 'fail'] } },
      required: ['expected'],
      additionalProperties: false,
    },
  };
  const host = new LocalMcp([binding], (tool, args) => activation.invoke(tool, args), () => {});
  const client = new Client({ name: 'fixture', version: '1' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(await host.start())));
    const result = await client.callTool({ name: 'owner-tests', arguments: { expected: 'pass' } });
    assert(!result.isError);
    const content = result.content as { type: string; text: string }[];
    const observed = JSON.parse(content[0]!.text);
    assert.equal(observed.status, 37);
    assert.equal(observed.log, '/evidence/check.log');
    assert.deepEqual(calls, ['owner-tests']);
  } finally {
    await client.close();
    await host.close();
  }
});

test('a steward who queued checks gets a repair diagnostic before blocking on their results', async () => {
  const activation = testingActivation();
  await activation.invoke({ name: 'owner-tests', handler: 'check' }, { expected: 'pass' });
  assert.throws(
    () => activation.finish({ kind: 'blocked', reason: 'Still waiting for exit code' }),
    /queued.*owner-tests.*completed/i,
  );
});

test('describing an already queued check keeps only the mapped request', async () => {
  const activation = testingActivation();
  await activation.invoke({ name: 'owner-tests', handler: 'check' }, { expected: 'pass' });
  assert.deepEqual(
    activation.finish({
      kind: 'completed',
      checks: 'Queued owner-tests. The host will observe its result.',
    }),
    { kind: 'completed', edits: [], checks: [{ id: 'owner-tests', expected: 'pass' }] },
  );
  assert.throws(
    () => activation.finish({ kind: 'completed', checks: [{ id: 'unmapped', expected: 'pass' }] }),
    /Use mapped MCP tools/,
  );
  assert.throws(
    () => testingActivation().finish({ kind: 'completed', checks: 'Run owner-tests.' }),
    /Use mapped MCP tools/,
  );
});

test('a self-linked supplier request leaves the steward active for a different contribution', async () => {
  const activation = testingActivation();
  const tool = { name: 'request-supplier', handler: 'supplier' } as const;
  const request = { owner: 'fixture', milestone: 'current', reason: 'Need a contribution' };
  await assert.rejects(activation.invoke(tool, request), /current.*continue this activity/i);
  assert(!activation.requestedHandoff);
  const distinct = { ...request, milestone: 'distinct' };
  await activation.invoke(tool, distinct);
  assert.deepEqual(activation.finish({}), { kind: 'supplier', ...distinct });
});

test('restart leaves a formerly acknowledged self-link in the journal and resumes the activity', () => {
  const activation = testingActivation(true);
  assert(!activation.requestedHandoff);
  assert.deepEqual(activation.finish({ kind: 'completed' }), {
    kind: 'completed',
    edits: [],
    checks: [],
  });
});
