import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { operationTool } from '../../../architecture/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import { LocalMcp } from '../../src/mcp.js';
import { StewardFixture } from '../fixtures/steward.js';

export const suite = {
  owner: 'execution',
  level: 'integration',
  tags: ['regression'],
} as const;

const source = 'const path = /(^|\\/)(?:dist|\\.git)(\\/|$)/;\nconst quote = "read me";\n';

/** Exercise readable source and supported repair modes over the actual MCP transport. */
class SourceRepair {
  private readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-mcp-source-'));
  private readonly client = new Client({ name: 'fixture', version: '1' });
  private readonly task;
  private readonly host;
  readonly refusals: string[] = [];

  /** Bind real checked edits and source reads to an isolated owner and journal. */
  constructor(t: TestContext) {
    this.task = new StewardFixture(t, this.root).task;
    writeFileSync(join(this.root, 'fixture.txt'), source);
    const activation = new ActivationTools(
      this.task,
      { component: 'owner', activity: 'implementation' },
      { goal: 'Repair source', assignment: {}, acceptance: [], worktree: this.root },
      new AbortController().signal,
    );
    this.host = new LocalMcp(
      [operationTool('read-file', 'read'), operationTool('checked-edit', 'edit')],
      (tool, args) => activation.invoke(tool, args),
      (_name, error) => {
        if (error) this.refusals.push(error);
      },
    );
    t.after(async () => {
      await this.client.close();
      await this.host.close();
      this.task.close();
    });
  }

  /** Connect the real client before assertions, without starting a model provider. */
  async start() {
    await this.client.connect(new StreamableHTTPClientTransport(new URL(await this.host.start())));
    return this;
  }

  /** Preserve exact structured bytes while exposing literal source rather than JSON escapes. */
  async read() {
    const reply = await this.client.callTool({
      name: 'read-file',
      arguments: { path: 'fixture.txt' },
    });
    assert(!reply.isError);
    assert.deepEqual(reply.structuredContent, {
      path: 'fixture.txt',
      sha256: this.digest(),
      text: source,
    });
    const content = reply.content as { text: string }[];
    assert(content[0]!.text.endsWith(`\n\n${source}`));
    assert(content[0]!.text.includes(this.digest()));
  }

  /** Read an entire large UTF-8 source through MCP without application size or chunk ceilings. */
  async completeRead(text: string) {
    writeFileSync(join(this.root, 'fixture.txt'), text);
    const reply = await this.client.callTool({
      name: 'read-file',
      arguments: { path: 'fixture.txt' },
    });
    assert(!reply.isError, 'A permitted text file must remain readable');
    const source = reply.structuredContent as { text: string };
    assert.equal(source.text.length, text.length);
    assert.equal(createHash('sha256').update(source.text).digest('hex'), this.digest(text));
  }

  /** Carry a complete checked edit through HTTP without an inherited application body-size ceiling. */
  async completeEdit(content: string) {
    const reply = await this.client.callTool({
      name: 'checked-edit',
      arguments: {
        path: 'fixture.txt',
        expected: this.digest(),
        content,
      },
    });
    assert(!reply.isError);
    assert.equal(
      createHash('sha256')
        .update(readFileSync(join(this.root, 'fixture.txt')))
        .digest('hex'),
      this.digest(content),
    );
  }

  /** Refuse an empty anchor, retain its diagnostic, then repair through existing full content. */
  async repair() {
    const expected = this.digest();
    const refused = await this.client.callTool({
      name: 'checked-edit',
      arguments: {
        path: 'fixture.txt',
        expected,
        transform: { replace: { before: '', after: '' } },
      },
    });
    assert(refused.isError);
    assert.match(this.refusals[0]!, /nonempty.*content.*omit.*transform/s);
    assert.equal(readFileSync(join(this.root, 'fixture.txt'), 'utf8'), source);
    await this.completeRepair(expected);
  }

  /** Complete a full-content replacement against the same hash and retain its receipt. */
  private async completeRepair(expected: string) {
    const repaired = await this.client.callTool({
      name: 'checked-edit',
      arguments: {
        path: 'fixture.txt',
        expected,
        content: 'repaired\n',
      },
    });
    assert(!repaired.isError);
    assert.equal(readFileSync(join(this.root, 'fixture.txt'), 'utf8'), 'repaired\n');
    assert.equal(this.refusals.length, 1);
    assert(
      this.task
        .observations<{ editReceipt?: { before: string } }>()
        .some(({ editReceipt }) => editReceipt?.before === expected),
    );
  }

  /** Hash complete source independently from the tool response. */
  private digest(text = source) {
    return createHash('sha256').update(text).digest('hex');
  }
}

test('MCP reads preserve complete large source files without imposed size or chunk caps', async (t) => {
  await (await new SourceRepair(t).start()).completeRead('Ω'.repeat(9_000_000));
});

test('MCP checked edits preserve complete requests beyond the transport default body cap', async (t) => {
  await (await new SourceRepair(t).start()).completeEdit('Complete source.\n'.repeat(400_000));
});

test('MCP source reads retain structured bytes and show literal quotes, backslashes and lines', async (t) => {
  await (await new SourceRepair(t).start()).read();
});

test('MCP empty-anchor refusal names supported full-content repair without losing the current hash', async (t) => {
  await (await new SourceRepair(t).start()).repair();
});
