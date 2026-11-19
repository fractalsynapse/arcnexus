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
      { component: 'owner', activity: 'implementation' },
      { goal: 'Research an implementation choice', milestone: { id: 'current' } },
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
  async run(permitted: boolean) {
    await this.client.connect(new StreamableHTTPClientTransport(new URL(await this.host.start())));
    const result = await this.client.callTool({ name: 'request-research', arguments: request });
    assert.equal(Boolean(result.isError), !permitted);
    const recorded = this.task
      .observations<{ projectRequest?: unknown }>()
      .filter(({ projectRequest }) => projectRequest);
    assert.equal(recorded.length, permitted ? 1 : 0);
    if (permitted) assert.deepEqual(this.activation.finish({}), { kind: 'research', ...request });
    else assert.equal(this.activation.requestedHandoff, false);
  }
}

for (const permitted of [true, false]) {
  test(`MCP research request enforces mapped read-only capability: ${permitted}`, async (t) => {
    await new ResearchMcpScenario(t, permitted).run(permitted);
  });
}
