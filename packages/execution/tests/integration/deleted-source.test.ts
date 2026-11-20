import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { operationTool } from '../../../architecture/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import { git } from '../../src/git.js';
import { LocalMcp } from '../../src/mcp.js';
import { StewardFixture } from '../fixtures/steward.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

const source = '\nconst name = "π";\n\n';
const digest = createHash('sha256').update(source).digest('hex');

/** Restore an acknowledged deletion over MCP using real Git history and ordinary checked edits. */
class DeletedSource {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-deleted-source-'));
  readonly task;
  readonly client = new Client({ name: 'deleted-source', version: '1' });
  private readonly host;

  /** Keep fixture application storage ignored while retaining the owned source in its issue branch. */
  constructor(t: TestContext) {
    this.task = new StewardFixture(t, this.root).task;
    this.prepareGit();
    const activation = new ActivationTools(
      this.task,
      { component: 'owner', activity: 'implementation' },
      {},
      new AbortController().signal,
    );
    this.host = new LocalMcp(
      [operationTool('read-file', 'read'), operationTool('checked-edit', 'edit')],
      (tool, args) => activation.invoke(tool, args),
      () => {},
    );
    t.after(async () => {
      await this.client.close();
      await this.host.close();
      this.task.close();
    });
  }

  /** Prepare a real parent blob with significant leading, Unicode and trailing source bytes. */
  private prepareGit() {
    git(this.root, 'init', '-q');
    git(this.root, 'config', 'user.name', 'Fixture');
    git(this.root, 'config', 'user.email', 'fixture@example.com');
    writeFileSync(join(this.root, '.gitignore'), '*\n!fixture.txt\n');
    writeFileSync(join(this.root, 'fixture.txt'), source);
    git(this.root, 'add', '-f', '.gitignore', 'fixture.txt');
    git(this.root, 'commit', '-qm', 'Fixture baseline');
    git(this.root, 'checkout', '-qb', '7-task');
    this.task.branch = '7-task';
    this.task.issue = '7';
  }

  /** Connect the same captured operations used by a live steward. */
  async start() {
    await this.client.connect(new StreamableHTTPClientTransport(new URL(await this.host.start())));
  }

  /** Retain tool errors on the wire instead of manufacturing missing-source results. */
  call(name: string, args: Record<string, unknown>) {
    return this.client.callTool({ name, arguments: args });
  }

  /** Delete the owned file through the checkpointing tool before attempting recovery. */
  async remove() {
    assert(
      !(await this.call('checked-edit', { path: 'fixture.txt', expected: digest, content: null }))
        .isError,
    );
    assert(!existsSync(join(this.root, 'fixture.txt')));
    return git(this.root, 'rev-parse', 'HEAD');
  }

  /** Demand a real missing-file diagnostic and an explicitly historical, digest-verified artifact. */
  async historical() {
    const refusal = await this.call('read-file', { path: 'fixture.txt' });
    assert(refusal.isError);
    const text = (refusal.content as { text: string }[])[0]!.text;
    assert.match(text, /Current expected hash: null/);
    const match = text.match(/Historical source: ("[^\n]+")/);
    assert(match, text);
    const path = JSON.parse(match[1]!) as string;
    const response = await this.call('read-file', { path });
    assert(!response.isError, JSON.stringify(response));
    const read = response.structuredContent as { text: string; sha256: string };
    assert.equal(read.text, source);
    assert.equal(read.sha256, digest);
    assert(!existsSync(join(this.root, 'fixture.txt')));
    return path;
  }
}

test('acknowledged deletion exposes exact parent source and restoration remains a new checked edit', async (t) => {
  const fixture = new DeletedSource(t);
  await fixture.start();
  const deleted = await fixture.remove();
  const artifact = await fixture.historical();
  assert.equal(await fixture.historical(), artifact);
  const result = await fixture.call('checked-edit', {
    path: 'fixture.txt',
    expected: null,
    content: source,
  });
  assert(!result.isError, JSON.stringify(result));
  assert.equal(readFileSync(join(fixture.root, 'fixture.txt'), 'utf8'), source);
  assert.equal(readFileSync(artifact, 'utf8'), source);
  assert.notEqual(git(fixture.root, 'rev-parse', 'HEAD'), deleted);
  assert(
    fixture.task
      .observations<any>()
      .some(
        ({ checkpoint, editReceipt }) =>
          checkpoint?.head === deleted && editReceipt?.after === null,
      ),
  );
});

for (const invalid of [
  'unknown',
  'unacknowledged',
  'wrong-digest',
  'no-checkpoint',
  'foreign',
  'control-path',
] as const) {
  test(`missing source recovery refuses ${invalid} evidence`, async (t) => {
    const fixture = new DeletedSource(t);
    await fixture.start();
    if (invalid === 'unacknowledged') unlinkSync(join(fixture.root, 'fixture.txt'));
    else await fixture.remove();
    if (invalid === 'wrong-digest' || invalid === 'no-checkpoint') {
      const event = fixture.task.observations<any>().findLast(({ editReceipt }) => editReceipt);
      fixture.task.note({
        ...event,
        ...(invalid === 'no-checkpoint'
          ? { checkpoint: undefined }
          : { editReceipt: { ...event.editReceipt, before: '0'.repeat(64) } }),
      });
    }
    const path =
      invalid === 'unknown'
        ? 'unknown.txt'
        : invalid === 'foreign'
          ? '../fixture.txt'
          : invalid === 'control-path'
            ? '.git/config'
            : 'fixture.txt';
    const result = await fixture.call('read-file', { path });
    assert(result.isError);
    assert.doesNotMatch((result.content as { text: string }[])[0]!.text, /Historical source:/);
  });
}
