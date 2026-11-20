#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Record actual native transport without claiming live model or harness discovery behavior. */
class InspectionProvider {
  /** Capture stdin, argv, guidance visibility, tool discovery and refused effect attempts. */
  async run() {
    const input = readFileSync(0, 'utf8');
    const tools = await this.rpc('tools/list');
    const refusals = [];
    for (const name of [tools.tools.some((tool: { name: string }) => tool.name === 'inspect-read') ? 'inspect-list' : 'inspect-read', 'shell']) {
      refusals.push(await this.rpc('tools/call', { name, arguments: {} }));
    }
    if (tools.tools.some((tool: { name: string }) => tool.name === 'owned-edit'))
      refusals.push(
        await this.rpc('tools/call', {
          name: 'owned-edit',
          arguments: { path: 'review/foreign.txt', expected: null, content: 'unauthorized' },
        }),
      );
    this.emit({
      type: 'fixture.inspection',
      input,
      args: process.argv.slice(2),
      cwd: process.cwd(),
      node: process.version,
      executable: process.argv[1],
      tools: tools.tools,
      refusals,
      guidance: readFileSync(join(process.cwd(), 'AGENTS.md'), 'utf8'),
      skill: readFileSync(join(process.cwd(), '.agents/skills/example/SKILL.md'), 'utf8'),
    });
    this.emit({
      type: 'item.completed',
      item: { type: 'agent_message', text: '{"kind":"completed"}' },
    });
  }

  /** Send actual JSON-RPC requests to production LocalMcp using its native binding. */
  private async rpc(method: string, params?: unknown): Promise<any> {
    const setting = process.argv.find((arg) => arg.startsWith('mcp_servers='));
    if (!setting) throw new Error('Missing native MCP binding');
    const url = JSON.parse(setting.split('url=')[1]!.split(',required=')[0]!);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const body = (await response.json()) as any;
    if (!response.ok || body.error) throw new Error(JSON.stringify(body));
    return body.result;
  }

  /** Keep complete controlled observations in the existing native transcript. */
  private emit(value: unknown) {
    process.stdout.write(JSON.stringify(value) + '\n');
  }
}

await new InspectionProvider().run();
