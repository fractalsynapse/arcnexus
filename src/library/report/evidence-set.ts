import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { OperationBridge } from '../operations/operations.js';
import type { BridgeTool } from '../steward/bridge.js';

/** One advertised artifact: where it lives, what it is, and how big it measurably is. */
export interface EvidenceArtifact {
  id: string;
  path: string;
  sha256: string;
  encoding: string;
  bytes: number;
  lines: number;
}

/**
 * Publishes evidence **by reference** with full measurement, in place of a paging subsystem.
 *
 * Every artifact is retained once as a real file under the run's own directory and advertised by
 * identity, digest and measured size. A read is a slice of those bytes, so repeating an
 * inspection costs what it actually costs and nothing is re-rendered into a second copy of the
 * same content. Sizes are recorded, never capped: the point of the measures is to make the cost of
 * a loop visible to the reader and to review, not to hide it behind a window that silently drops
 * detail.
 *
 * Filesystem paths are host-chosen. A worker supplies an artifact id and optional offsets, never a
 * path it wants read.
 */
export class EvidenceSet {
  private readonly artifacts = new Map<string, EvidenceArtifact>();

  private reads = 0;

  /** Binds the advertised capability name before any artifact is retained. */
  constructor(
    private readonly name: string,
    private readonly store: string,
  ) {
    mkdirSync(store, { recursive: true, mode: 0o700 });
  }

  /** Exposes the single read-only capability to an assignment-bound connection. */
  get tools(): BridgeTool[] {
    return [
      {
        name: this.name,
        description:
          'Read one retained artifact by id, optionally a slice by offset and length. ' +
          'Advertised ids, digests and measured sizes appear in the manifest.',
        inputSchema: {
          type: 'object',
          properties: {
            artifact: { type: 'string', description: 'Advertised artifact id' },
            offset: { type: 'number', description: 'Zero-based character offset' },
            length: { type: 'number', description: 'Characters to read from the offset' },
          },
          required: ['artifact'],
        },
      },
    ];
  }

  /** Rejects an unknown capability name before touching a retained artifact. */
  async call(name: string, args: unknown): Promise<unknown> {
    if (name !== this.name) throw new Error('Unknown evidence capability');
    return this.read(args);
  }

  /** Retains bytes once and advertises the reference plus its measures. */
  add(id: string, content: string, encoding: string): void {
    const path = join(this.store, this.file(id));
    this.assertSafe(path, true);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, content, { mode: 0o600 });
    this.reference(id, path, encoding);
  }

  /** Adopts an artifact the host already retained, measuring it without rewriting a byte. */
  adopt(id: string, path: string, encoding: string): void {
    this.assertSafe(path);
    this.reference(id, path, encoding);
  }

  /** Adds selected fields of a structured record as one retained JSON artifact. */
  addSections(id: string, value: Record<string, unknown>, sections: string[] = []): void {
    const selected = sections.length
      ? Object.fromEntries(sections.filter((key) => key in value).map((key) => [key, value[key]]))
      : value;
    this.add(id, JSON.stringify(selected, null, 2), 'json');
  }

  /** The advertised catalog: identity, digest and measured size for everything retained. */
  metadata(): EvidenceArtifact[] {
    return [...this.artifacts.values()];
  }

  /** The entry-point catalog; grouped indexes are retained so the full list stays reachable. */
  navigation() {
    const visible = this.metadata().filter((item) => !item.id.startsWith('artifact-index:'));
    const groups = new Map<string, EvidenceArtifact[]>();
    for (const item of visible) {
      if (!item.id.includes(':')) continue;
      const prefix = item.id.split(':')[0]!;
      groups.set(prefix, [...(groups.get(prefix) ?? []), item]);
    }
    for (const [prefix, items] of groups)
      this.add('artifact-index:' + prefix, JSON.stringify(items, null, 2), 'json');
    return this.metadata().filter(
      (item) => !item.id.includes(':') || item.id.startsWith('artifact-index:'),
    );
  }

  /** Measures of how the capability was used, recorded so cost is visible rather than limited. */
  measures() {
    return {
      capability: this.name,
      artifacts: this.artifacts.size,
      reads: this.reads,
      bytes: [...this.artifacts.values()].reduce((total, item) => total + item.bytes, 0),
    };
  }

  /** Extends the declared operations with the fixed read-only artifact capability. */
  wrap(operations: OperationBridge): OperationBridge {
    return {
      ...operations,
      tools: [...operations.tools, ...this.tools],
      call: async (name, args) =>
        name === this.name ? this.read(args) : operations.call(name, args),
    };
  }

  /** Writes the manifest beside the artifacts so a later reader can resolve every reference. */
  retain(directory: string, manifest: unknown): unknown {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const payload = { ...(manifest as object), measures: this.measures() };
    writeFileSync(join(directory, 'evidence-manifest.json'), JSON.stringify(payload, null, 2), {
      mode: 0o600,
    });
    return payload;
  }

  /** Reads a slice of the retained bytes, returning what was served alongside its measures. */
  private read(args: unknown) {
    const input = (args ?? {}) as { artifact?: string; offset?: number; length?: number };
    const artifact = this.artifacts.get(String(input.artifact ?? ''));
    if (!artifact)
      throw new Error('Unknown evidence artifact: ' + String(input.artifact ?? '(none given)'));
    this.assertSafe(artifact.path);
    const content = readFileSync(artifact.path, 'utf8');
    const offset = Math.max(0, Math.floor(input.offset ?? 0));
    const served =
      input.length === undefined
        ? content.slice(offset)
        : content.slice(offset, offset + input.length);
    this.reads++;
    return {
      artifact: artifact.id,
      sha256: artifact.sha256,
      encoding: artifact.encoding,
      offset,
      returnedCharacters: served.length,
      totalCharacters: content.length,
      truncated: offset + served.length < content.length,
      content: served,
    };
  }

  /** Measures one retained file once and records its reference. */
  private reference(id: string, path: string, encoding: string): void {
    const bytes = readFileSync(path);
    const content = bytes.toString('utf8');
    this.artifacts.set(id, {
      id,
      path,
      encoding,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      lines: content.length ? content.split('\n').length : 0,
    });
  }

  /** A stable, host-chosen filename for an artifact id. */
  private file(id: string): string {
    const safe = createHash('sha256').update(id).digest('hex').slice(0, 24);
    return this.artifacts.get(id)?.path
      ? this.artifacts.get(id)!.path.split('/').pop()!
      : 'artifact-' + safe;
  }

  /** Rejects symlinked ancestors, shared inodes and non-regular files before reading bytes. */
  private assertSafe(path: string, missing = false): void {
    let current = path;
    while (true) {
      try {
        const stat = lstatSync(current);
        if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink !== 1))
          throw new Error('Unsafe evidence artifact alias');
        if (current === path && !missing && !stat.isFile())
          throw new Error('Evidence artifact is not a regular file');
      } catch (error) {
        if (!missing || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      if (current === dirname(current)) break;
      current = dirname(current);
    }
    if (!missing && !existsSync(path)) throw new Error('Evidence artifact is missing');
  }
}
