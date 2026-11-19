import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { AgentInspection } from '../../../architecture/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import { LocalMcp } from '../../src/mcp.js';
import { StewardFixture } from '../fixtures/steward.js';

type Binding = AgentInspection['request']['options']['tools'][number];

/** Make the narrow wire schema for a captured fixture operation. */
function binding(name: string, handler: string, properties: Record<string, object>): Binding {
  return {
    name,
    handler,
    description: name,
    inputSchema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
  } as Binding;
}

/** Decode the actual MCP response while preserving tool errors as test failures. */
async function call(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  assert(!result.isError, JSON.stringify(result));
  const content = result.content as { text: string }[];
  return JSON.parse(content[0]!.text);
}

test('MCP check, checked correction, recheck and supplier handoff retain observations', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-mcp-repair-'));
  const task = new StewardFixture(t, root).task;
  t.after(() => task.close());
  writeFileSync(join(root, 'fixture.txt'), 'broken');
  const checks: string[] = [];
  t.mock.method(task, 'check', async (id: string, _signal: AbortSignal, scope?: Parameters<typeof task.check>[2]) => {
    const status = readFileSync(join(root, 'fixture.txt'), 'utf8') === 'fixed' ? 0 : 37;
    const log = task.store('fixture-check.log', `exit ${status}\n`);
    const check = { id, status, log, command: 'fixture', args: [], cwd: root, durationMs: 1 };
    task.note({ check, scope });
    checks.push(log);
    return check;
  });
  const activation = new ActivationTools(task, { component: 'owner', activity: 'implementation' },
    { goal: 'repair', assignment: {}, milestone: { id: 'current' }, acceptance: [], worktree: root },
    new AbortController().signal);
  const host = new LocalMcp([
    binding('owner-tests', 'check', { expected: { type: 'string' } }),
    binding('checked-edit', 'edit', { path: { type: 'string' }, expected: { type: 'string' }, content: { type: 'string' } }),
    binding('request-supplier', 'supplier', { owner: { type: 'string' }, milestone: { type: 'string' }, reason: { type: 'string' } }),
  ], (tool, args) => activation.invoke(tool, args), () => {});
  const client = new Client({ name: 'fixture', version: '1' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(await host.start())));
    const first = await call(client, 'owner-tests', { expected: 'pass' });
    assert.equal(first.status, 37);
    const expected = createHash('sha256').update('broken').digest('hex');
    const receipt = await call(client, 'checked-edit', { path: 'fixture.txt', expected, content: 'fixed' });
    assert.equal(receipt.path, 'fixture.txt');
    const second = await call(client, 'owner-tests', { expected: 'pass' });
    assert.equal(second.status, 0);
    assert.notEqual(first.log, second.log);
    assert.equal(readFileSync(first.log, 'utf8'), 'exit 37\n');
    assert.equal(readFileSync(second.log, 'utf8'), 'exit 0\n');
    await call(client, 'request-supplier', { owner: 'other', milestone: 'supplier', reason: 'Distinct work' });
    assert.equal(activation.finish({ kind: 'completed' }).kind, 'supplier');
    assert.equal(checks.length, 2);
  } finally {
    await client.close();
    await host.close();
  }
});
