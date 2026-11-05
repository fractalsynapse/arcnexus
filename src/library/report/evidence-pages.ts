import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OperationBridge } from '../operations/operations.js';
import type { BridgeTool } from '../steward/bridge.js';

interface Artifact {
  id: string;
  content: string;
  sha256: string;
  path?: string;
  encoding: string;
}

/** Serves immutable host artifacts through bounded pages without accepting filesystem paths. */
export class EvidencePages {
  private readonly artifacts = new Map<string, Artifact>();

  /** Binds the advertised capability name before any artifacts are captured. */
  constructor(private readonly name: string) {}

  /** Exposes the single read-only capability to an assignment-bound connection. */
  get tools(): BridgeTool[] {
    return [this.tool()];
  }

  /** Rejects unknown capability names before reading a pinned artifact. */
  async call(name: string, args: unknown): Promise<unknown> {
    if (name !== this.name) throw new Error('Unknown evidence capability');
    return this.read(args);
  }

  /** Lists content identities without copying artifact bodies into the initial prompt. */
  metadata() {
    return [...this.artifacts.values()].map(({ content, ...metadata }) => ({
      ...metadata,
      totalCharacters: content.length,
    }));
  }

  /** Extends the declared operations with a fixed read-only artifact capability. */
  wrap(operations: OperationBridge): OperationBridge {
    return {
      ...operations,
      tools: [...operations.tools, this.tool()],
      call: async (name, args) =>
        name === this.name ? this.read(args) : operations.call(name, args),
    };
  }

  /** Hashes exact served content and assigns a capability name unrelated to host filesystem lookup. */
  add(id: string, content: string, encoding: string, path?: string): void {
    const sha256 = createHash('sha256').update(content).digest('hex');
    this.artifacts.set(id, { id, content, sha256, encoding, ...(path ? { path } : {}) });
  }

  /** Saves immutable evidence copies by content hash and records the manifest for historical inspection. */
  retain(directory: string, manifest: unknown): unknown {
    const destination = join(directory, this.name.replace('.', '-'));
    mkdirSync(destination, { mode: 0o700, recursive: true });
    for (const artifact of this.artifacts.values())
      this.persist(join(destination, artifact.sha256), artifact.content);
    return {
      ...(manifest as object),
      directory: destination,
      manifest: this.artifacts.get('manifest')!.sha256,
    };
  }

  /** Reuses only identical regular content-addressed artifacts and never overwrites a prior capture. */
  private persist(path: string, content: string): void {
    if (existsSync(path)) {
      const stat = lstatSync(path);
      if (!stat.isFile() || stat.nlink !== 1 || readFileSync(path, 'utf8') !== content)
        throw new Error('Pinned evidence artifact differs from its content identity');
      return;
    }
    writeFileSync(path, content, { mode: 0o400, flag: 'wx' });
  }

  /** Validates bounded transport pages without limiting how much evidence a reviewer may inspect. */
  private read(args: unknown): unknown {
    const request = this.request(args);
    if (!request) return this.rejected('Invalid retained evidence arguments');
    const artifact = this.artifacts.get(request.artifact);
    if (!artifact) return this.rejected('Unknown ' + this.name.split('.')[0] + ' artifact');
    const page = this.page(request, artifact.content.length);
    if (!page)
      return {
        status: 'rejected',
        error: 'Invalid retained evidence page',
        minimumOffset: 0,
        maximumOffset: artifact.content.length,
        minimumLength: 1,
        maximumLength: 32768,
      };
    const { offset, length } = page;
    const content = artifact.content.slice(offset, offset + length);
    const nextOffset = offset + content.length;
    return {
      artifact: artifact.id,
      sha256: artifact.sha256,
      totalCharacters: artifact.content.length,
      offset,
      nextOffset,
      complete: nextOffset === artifact.content.length,
      content,
    };
  }

  /** Validates client-supplied names without coercion, path lookup or additional authority fields. */
  private request(args: unknown) {
    if (!args || typeof args !== 'object' || Array.isArray(args)) return;
    const request = args as Record<string, unknown>;
    if (
      Object.keys(request).some((key) => !['artifact', 'offset', 'length'].includes(key)) ||
      typeof request.artifact !== 'string' ||
      !request.artifact
    )
      return;
    return { artifact: request.artifact, offset: request.offset, length: request.length };
  }

  /** Keeps recoverable client mistakes distinct from corrupted evidence and unknown capability routing. */
  private rejected(error: string) {
    return {
      status: 'rejected',
      error,
      recovery: 'Read artifact=manifest on this capability and use its advertised artifact names.',
    };
  }

  /** Rejects malformed or out-of-range page requests before slicing captured content. */
  private page(
    request: Record<string, unknown>,
    total: number,
  ): { offset: number; length: number } | undefined {
    const offset = request.offset ?? 0;
    const length = request.length ?? 8192;
    if (
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(length) ||
      Number(offset) < 0 ||
      Number(offset) > total ||
      Number(length) < 1 ||
      Number(length) > 32768
    )
      return undefined;
    return { offset: Number(offset), length: Number(length) };
  }

  /** Advertises explicit paging and fixed artifact names without exposing arbitrary filesystem access. */
  private tool(): BridgeTool {
    return {
      name: this.name,
      description:
        'Read pinned host evidence. Start with artifact=manifest, then read its artifacts. Follow nextOffset until complete; offsets and lengths count JavaScript string characters.',
      inputSchema: {
        type: 'object',
        properties: {
          artifact: { type: 'string' },
          offset: { type: 'integer', minimum: 0 },
          length: { type: 'integer', minimum: 1, maximum: 32768 },
        },
        required: ['artifact'],
        additionalProperties: false,
      },
    };
  }
}
