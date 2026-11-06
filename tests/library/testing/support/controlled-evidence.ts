import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';

/** Inspects captured verification artifacts through the actual SDK-configured MCP boundary. */
export class ControlledEvidence {
  /** Retains a test-owned trace outside the editable candidate. */
  constructor(
    private readonly trace: string,
    private readonly capability = 'verification.evidence',
    private readonly pageLength = 64,
  ) {}

  /** Reads all advertised evidence pages without using native Git or arbitrary host paths. */
  async inspect(args: string[], forbidden: boolean, retryPage = false) {
    const client = this.client();
    try {
      await client.connect(this.transport(args));
      if (retryPage) await this.rejectedPage(client);
      if (forbidden) await this.rejectedArtifacts(client);
      const manifest = JSON.parse(await this.read(client, 'manifest'));
      const artifacts = await this.artifacts(client, manifest.artifacts);
      appendFileSync(this.trace + '.evidence', JSON.stringify({ manifest, artifacts }) + '\n');
      return { manifest, artifacts };
    } finally {
      await client.close();
    }
  }

  /** Traverses retained catalog references through MCP without substituting direct filesystem reads. */
  private async artifacts(client: Client, metadata: Array<{ id: string }>) {
    const pending = [...metadata];
    const result: Record<string, string> = {};
    while (pending.length) {
      const { id } = pending.shift()!;
      if (Object.hasOwn(result, id)) continue;
      result[id] = await this.read(client, id);
      if (id.startsWith('artifact-index:')) pending.push(...JSON.parse(result[id]));
    }
    return result;
  }

  /** Builds the SDK client independently from the captured command transport. */
  private client(): Client {
    return new Client({ name: 'controlled-verifier', version: '1' }, { capabilities: {} });
  }

  /** Resolves the host-supplied bridge command without substituting test filesystem access. */
  private transport(args: string[]): StdioClientTransport {
    const option = (key: string) =>
      JSON.parse(
        args
          .find((arg) => arg.startsWith('mcp_servers.arcnexus.' + key + '='))!
          .split('=')
          .slice(1)
          .join('='),
      );
    return new StdioClientTransport({ command: option('command'), args: option('args') });
  }

  /** Unknown or foreign artifact names disclose no bytes and do not terminate the real MCP connection. */
  private async rejectedArtifacts(client: Client): Promise<void> {
    for (const artifact of ['../report.json', 'supplier:edit:foreign.json']) {
      const reply: any = await client.callTool({ name: this.capability, arguments: { artifact } });
      const rejection = JSON.parse(reply.content[0].text);
      if (reply.isError || rejection.status !== 'rejected' || 'content' in rejection)
        throw new Error('Unknown artifact did not return a content-free corrective rejection');
      if (!rejection.recovery?.includes('artifact=manifest'))
        throw new Error('Unknown artifact omitted manifest recovery guidance');
    }
  }

  /** A malformed transport page must be rejected without ending the verifier activation. */
  private async rejectedPage(client: Client): Promise<void> {
    const reply: any = await client.callTool({
      name: this.capability,
      arguments: { artifact: 'manifest', offset: 0, length: 0 },
    });
    const rejection = JSON.parse(reply.content[0].text);
    if (reply.isError || rejection.status !== 'rejected' || rejection.minimumLength !== 1)
      throw new Error('Invalid page did not return recoverable bounds');
    if ('content' in rejection) throw new Error('Rejected page exposed content');
  }

  /** Follows explicit page offsets until the host reports complete evidence, retaining all content. */
  private async read(client: Client, artifact: string): Promise<string> {
    let offset = 0;
    let text = '';
    while (true) {
      const reply: any = await client.callTool({
        name: this.capability,
        arguments: { artifact, offset, length: this.pageLength },
      });
      if (reply.isError) throw new Error(reply.content[0].text);
      const page = JSON.parse(reply.content[0].text);
      if (page.offset !== offset || (page.nextOffset <= offset && !page.complete))
        throw new Error('Evidence paging lost progress');
      text += page.content;
      if (page.complete) {
        if (
          page.totalCharacters !== text.length ||
          createHash('sha256').update(text).digest('hex') !== page.sha256
        )
          throw new Error('Evidence content differs from pinned artifact');
        return text;
      }
      offset = page.nextOffset;
    }
  }
}
