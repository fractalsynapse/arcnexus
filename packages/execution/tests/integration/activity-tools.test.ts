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

/** Model a completed host operation so transport tests can assert its exact receipt. */
function testingTask(events: unknown[]) {
  return {
    taskID: 'fixture',
    capture: { source: { revision: 'staging' }, project: {} },
    observations: () => events,
    note: (event: unknown) => events.push(event),
    check: async (id: string, _signal: AbortSignal, scope: unknown) => {
      const check = {
        id,
        status: 37,
        log: 'fixture.log',
        command: 'fixture',
        args: [],
        cwd: '.',
        durationMs: 0,
      };
      events.push({ check, scope });
      return check;
    },
  } as unknown as HostTask;
}

/** Open one native testing activation without invoking external services. */
function testingActivation(retainedSelfLink = false, activity = 'testing') {
  const selection = { component: 'fixture', activity };
  const input = {
    goal: 'Verify a checkpoint',
    assignment: {},
    milestone: { id: 'current' },
    acceptance: [],
    worktree: '.',
  };
  const events: unknown[] = [];
  const task = testingTask(events);
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

const checkBinding: Binding = {
  name: 'owner-tests',
  handler: 'check',
  description: 'Fixture check',
  inputSchema: {
    type: 'object',
    properties: { expected: { type: 'string', enum: ['pass', 'fail'] } },
    required: ['expected'],
    additionalProperties: false,
  },
};

test('MCP returns the completed host check before the caller continues', async () => {
  const activation = testingActivation();
  const host = new LocalMcp(
    [checkBinding],
    (tool, args) => activation.invoke(tool, args),
    () => {},
  );
  const client = new Client({ name: 'fixture', version: '1' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(await host.start())));
    const reply = await client.callTool({ name: 'owner-tests', arguments: { expected: 'pass' } });
    assert(!reply.isError);
    assert(Array.isArray(reply.content));
    const observed = JSON.parse(reply.content[0].text);
    assert.equal(observed.status, 37);
    assert.equal(observed.log, 'fixture.log');
    assert.deepEqual(activation.finish({ kind: 'completed' }), {
      kind: 'completed',
      edits: [],
      checks: [],
    });
    assert.deepEqual(activation.finish({ kind: 'blocked', reason: 'Exact caller finding' }), {
      kind: 'blocked',
      reason: 'Exact caller finding',
    });
  } finally {
    await client.close();
    await host.close();
  }
});

test('native replies cannot request raw checks after an observed MCP operation', async () => {
  const activation = testingActivation();
  await activation.invoke(checkBinding, { expected: 'pass' });
  for (const checks of ['Run owner-tests.', [{ id: 'unmapped', expected: 'pass' }]]) {
    assert.throws(() => activation.finish({ kind: 'completed', checks }), /Use mapped MCP tools/);
  }
});

test('a caller cannot change the expectation of its unresolved operation', async () => {
  const activation = testingActivation();
  await activation.invoke(checkBinding, { expected: 'pass' });
  await assert.rejects(
    activation.invoke(checkBinding, { expected: 'fail' }),
    /Cannot change the required recheck for owner-tests: expected pass/,
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
