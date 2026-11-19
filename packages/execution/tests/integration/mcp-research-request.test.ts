import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { operationTool } from '../../../architecture/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import { LocalMcp } from '../../src/mcp.js';
import { StewardFixture } from '../fixtures/steward.js';

const request = {
  question: 'Which upstream behavior applies?',
  decision: 'Choose the correct implementation',
};

export const suite = {
  owner: 'execution',
  level: 'integration',
  tags: ['research', 'recovery'],
} as const;

const milestone = {
  id: 'current',
  owner: 'owner',
  criteria: [],
  steps: [{ activity: 'implementation' as const, checklist: [] }],
};
const input = { milestone: { id: 'current', step: milestone.steps[0] }, acceptance: [] };
const selection = { component: 'owner', activity: 'implementation' };

/** Exercise optional read-only research at the actual MCP request boundary. */
class ResearchMcpScenario {
  private readonly task;
  private readonly activation;
  private readonly host;
  private readonly client = new Client({ name: 'fixture', version: '1' });

  /** Bind one activity and its explicit model research mapping to a real journal and transport. */
  constructor(t: TestContext, permitted: boolean) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-mcp-research-'));
    this.task = new StewardFixture(t, root).task;
    this.configure(permitted);
    this.activation = new ActivationTools(
      this.task,
      selection,
      input,
      new AbortController().signal,
    );
    this.host = new LocalMcp(
      [operationTool('request-research', 'research')],
      (tool, args) => this.activation.invoke(tool, args),
      () => {},
    );
    t.after(async () => {
      await this.client.close();
      await this.host.close();
      this.task.close();
    });
  }

  /** Resolve the declared handlers rather than treating an operation name as read-only authority. */
  private configure(permitted: boolean) {
    this.task.capture.components.owner!.activities.research = {
      role: 'researcher',
      profile: 'fixture',
      instructions: [],
      standards: [],
      operations: permitted ? ['read-file', 'list-files'] : ['checked-edit'],
    };
    Object.assign(this.task.capture, {
      operations: {
        'read-file': { kind: 'tool', tool: 'read' },
        'list-files': { kind: 'tool', tool: 'list' },
        'checked-edit': { kind: 'tool', tool: 'edit' },
      },
    });
  }

  /** Admit a complete inbox request or refuse it before creating a handoff. */
  async run(permitted: boolean, fields = request) {
    await this.client.connect(new StreamableHTTPClientTransport(new URL(await this.host.start())));
    const result = await this.client.callTool({ name: 'request-research', arguments: fields });
    assert.equal(Boolean(result.isError), !permitted);
    const recorded = this.task
      .observations<{ projectRequest?: unknown }>()
      .filter(({ projectRequest }) => projectRequest);
    assert.equal(recorded.length, permitted ? 1 : 0);
    if (permitted) {
      const replay = new ActivationTools(this.task, selection, input, new AbortController().signal);
      assert.deepEqual(this.activation.finish({}), { kind: 'research', ...fields });
      assert.deepEqual(replay.finish({}), recorded[0]!.projectRequest);
    } else assert.equal(this.activation.requestedHandoff, false);
  }

  /** Refuse a malformed wire call without claiming a handoff, then accept corrected fields. */
  async reject(args: Record<string, unknown>) {
    await this.client.connect(new StreamableHTTPClientTransport(new URL(await this.host.start())));
    const result = await this.client.callTool({ name: 'request-research', arguments: args });
    assert(result.isError, JSON.stringify(result));
    assert.equal(this.activation.requestedHandoff, false);
    assert.equal(
      this.task.observations<{ projectRequest?: unknown }>().some((e) => e.projectRequest),
      false,
    );
    const fields = { question: ` ${request.question} `, decision: ` ${request.decision} ` };
    const corrected = await this.client.callTool({
      name: 'request-research',
      arguments: fields,
    });
    assert(!corrected.isError, JSON.stringify(corrected));
    assert.deepEqual(this.activation.finish({}), { kind: 'research', ...fields });
  }
}

for (const permitted of [true, false]) {
  test(`MCP research request enforces mapped read-only capability: ${permitted}`, async (t) => {
    await new ResearchMcpScenario(t, permitted).run(permitted);
  });
}

for (const args of [{ ...request, question: '   ' }, { question: request.question }]) {
  test(`invalid MCP research fields remain repairable in the same activation: ${JSON.stringify(args)}`, async (t) => {
    await new ResearchMcpScenario(t, true).reject(args);
  });
}

test('MCP preserves complete detailed research questions and decision context', async (t) => {
  await new ResearchMcpScenario(t, true).run(true, {
    question: 'Research the complete requirements and interactions. '.repeat(100),
    decision: 'Explain alternatives, evidence and consequences for the implementation. '.repeat(
      100,
    ),
  });
});
