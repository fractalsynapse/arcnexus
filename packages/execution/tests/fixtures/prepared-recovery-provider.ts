#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

/** Exercise the actual provider transport and mapped effects with explicit deterministic replies. */
class PreparedRecoveryProvider {
  /** Record the received assignment, secure one edit, and ask once through production MCP. */
  async run() {
    const { data, tools } = await this.observeRequest();
    if (!existsSync('checked.txt')) return this.begin();
    const continuation = data.assignment.recoveryContinuation;
    const recovered = tools.tools.some((tool: { name: string }) => tool.name === 'current-read');
    if (recovered && continuation === 'replay') await this.replayEdit();
    if (recovered && continuation === 'question') {
      const question = 'Which newly captured requirement governs this continuation?';
      const answered = data.assignment.clarifications?.some(
        (gate: { question: string }) => gate.question === question,
      );
      if (!answered) {
        await this.rpc('tools/call', { name: 'ask-question', arguments: { question } });
        return this.reply({});
      }
    }
    this.reply({ kind: 'completed' });
  }

  /** Secure the first contribution and open its original human clarification. */
  private async begin() {
    const receipt = await this.rpc('tools/call', {
      name: 'checked-edit',
      arguments: {
        path: 'checked.txt',
        expected: null,
        content: 'secured checked bytes café\nsecond line\n',
      },
    });
    this.emit({ type: 'fixture.receipt', receipt });
    await this.rpc('tools/call', {
      name: 'ask-question',
      arguments: {
        question: 'Which requirement must recovery preserve?',
      },
    });
    return this.reply({});
  }

  /** Replay the identical acknowledged request and expose its complete original receipt. */
  private async replayEdit() {
    const receipt = await this.rpc('tools/call', {
      name: 'checked-edit',
      arguments: {
        path: 'checked.txt',
        expected: null,
        content: 'secured checked bytes café\\nsecond line\\n',
      },
    });
    this.emit({ type: 'fixture.replayed', receipt });
  }

  /** Capture the complete actual request and available tools independently of effect replies. */
  private async observeRequest() {
    const input = readFileSync(0, 'utf8');
    const taskSection = input.split('\n## Activity\n')[0]!;
    const data = parse('assignment:' + taskSection.split('\nassignment:')[1]!);
    const tools = await this.rpc('tools/list');
    this.emit({
      type: 'fixture.prepared',
      input,
      data,
      tools: tools.tools,
      node: process.version,
      args: process.argv.slice(2),
      executable: process.argv[1],
      cwd: process.cwd(),
    });
    return { data, tools };
  }

  /** Invoke the exact local tool mapping and reject an actual host refusal. */
  private async rpc(method: string, params?: unknown) {
    const setting = process.argv.find((arg) => arg.startsWith('mcp_servers='));
    if (!setting) throw new Error('Missing local MCP binding');
    const url = JSON.parse(setting.split('url=')[1]!.split(',required=')[0]!);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
    });
    const body = (await response.json()) as any;
    if (!response.ok || body.error || body.result?.isError) throw new Error(JSON.stringify(body));
    return body.result;
  }

  /** Emit a documented final provider message without embedding prior transcripts. */
  private reply(value: unknown) {
    this.emit({
      type: 'item.completed',
      item: { type: 'agent_message', text: JSON.stringify(value) },
    });
  }

  /** Retain complete authored observations through Execution's ordinary transcript. */
  private emit(value: unknown) {
    process.stdout.write(JSON.stringify(value) + '\n');
  }
}

await new PreparedRecoveryProvider().run();
