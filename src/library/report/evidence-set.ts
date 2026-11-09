import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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
  /** Characters available to read, advertised so a caller can plan a slice. */
  totalCharacters: number;
  /** Where the bytes came from, when an artifact was captured from somewhere else. */
  sourcePath?: string;
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
    readonly store: string,
  ) {
    this.store = join(store, name.replace('.', '-'));
    mkdirSync(this.store, { recursive: true, mode: 0o700 });
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

  /** Retains bytes once, content-addressed, and advertises the reference plus its measures. */
  add(id: string, content: string, encoding: string, sourcePath?: string): void {
    const path = join(this.store, createHash('sha256').update(content).digest('hex'));
    this.persist(path, content);
    this.reference(id, path, encoding, sourcePath);
  }

  /** Adopts an artifact the host already retained, measuring it without rewriting a byte. */
  adopt(id: string, path: string, encoding: string): void {
    this.assertSafe(path);
    this.reference(id, path, encoding);
  }

  /**
   * Pins selected sections as their own artifacts and indexes them by reference.
   *
   * The index stays readable while detail remains reachable: each listed field becomes an artifact
   * named `<id>:<field>` and the parent stores only pointers to it. Nothing is dropped to fit.
   */
  addSections(
    id: string,
    value: Record<string, unknown>,
    sections: string[] = [],
  ): { artifact: string } {
    const index = { ...value };
    for (const key of sections) {
      if (value[key] === undefined) continue;
      const artifact = id + ':' + key;
      this.add(artifact, JSON.stringify(value[key]), 'json');
      index[key] = { artifact };
    }
    this.add(id, JSON.stringify(index), 'json');
    return { artifact: id };
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

  /**
   * Publishes the retained set: its directory, the manifest's content identity, and the measures.
   *
   * The returned shape is what earlier evidence and reports read, so `directory` and `manifest`
   * keep their meaning and `measures` is added beside them rather than replacing either.
   */
  retain(directory: string, manifest: unknown): unknown {
    if (dirname(this.store) !== resolve(directory))
      throw new Error('Evidence set retains into the directory it was bound to');
    const entry = this.artifacts.get('manifest');
    if (!entry) throw new Error('Evidence manifest must be retained last');
    return {
      ...(manifest as object),
      directory: this.store,
      manifest: entry.sha256,
      measures: this.measures(),
    };
  }

  /**
   * Serves a bounded slice of the retained bytes with the transport fields the capability publishes.
   *
   * `nextOffset` and `complete` let a reader continue or stop knowingly; the default window is a
   * transport convenience, not a limit — an explicit length reads as much as the caller asks for,
   * and the measures say what the artifact really costs.
   */
  private read(args: unknown): unknown {
    const request = this.request(args);
    if (!request) return this.rejected('Invalid retained evidence arguments');
    const artifact = this.artifacts.get(request.artifact);
    if (!artifact) return this.rejected('Unknown ' + this.name.split('.')[0] + ' artifact');
    this.assertSafe(artifact.path);
    const content = readFileSync(artifact.path, 'utf8');
    const page = this.page(request, content.length);
    if (!page) return this.invalidPage(content.length);
    const served = content.slice(page.offset, page.offset + page.length);
    const nextOffset = page.offset + served.length;
    const complete = nextOffset === content.length;
    this.reads++;
    return {
      artifact: artifact.id,
      sha256: artifact.sha256,
      encoding: artifact.encoding,
      totalCharacters: content.length,
      offset: page.offset,
      nextOffset: complete ? null : nextOffset,
      complete,
      content: served,
    };
  }

  /** Accepts only an artifact id with optional offset and length; never a filesystem path. */
  private request(
    args: unknown,
  ): { artifact: string; offset?: number; length?: number } | undefined {
    if (!args || typeof args !== 'object' || Array.isArray(args)) return;
    const request = args as Record<string, unknown>;
    if (
      Object.keys(request).some((key) => !['artifact', 'offset', 'length'].includes(key)) ||
      typeof request.artifact !== 'string' ||
      !request.artifact
    )
      return;
    return {
      artifact: request.artifact,
      offset: request.offset as number,
      length: request.length as number,
    };
  }

  /** Bounds a page request without limiting how much evidence a reviewer may eventually inspect. */
  private page(
    request: { offset?: number; length?: number },
    total: number,
  ): { offset: number; length: number } | undefined {
    const offset = request.offset ?? 0;
    const length = request.length ?? 8192;
    if (
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(length) ||
      Number(offset) < 0 ||
      Number(offset) > total ||
      Number(length) < 1
    )
      return;
    return { offset: Number(offset), length: Number(length) };
  }

  /** Says plainly what a page request may address, without limiting eventual inspection. */
  private invalidPage(total: number): unknown {
    return {
      status: 'rejected',
      error: 'Invalid retained evidence page',
      minimumOffset: 0,
      maximumOffset: total,
      minimumLength: 1,
    };
  }

  /** Points a rejected request at the manifest instead of guessing at an artifact name. */
  private rejected(error: string): unknown {
    return {
      status: 'rejected',
      error,
      recovery: 'Read artifact=manifest on this capability and use its advertised artifact names.',
    };
  }

  /** Measures one retained file once and records its reference. */
  private reference(id: string, path: string, encoding: string, sourcePath?: string): void {
    const bytes = readFileSync(path);
    const content = bytes.toString('utf8');
    this.artifacts.set(id, {
      id,
      path,
      encoding,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      totalCharacters: content.length,
      lines: content.length ? content.split('\n').length : 0,
      ...(sourcePath ? { sourcePath } : {}),
    });
  }

  /** Reuses identical content-addressed bytes and never overwrites a prior capture. */
  private persist(path: string, content: string): void {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    if (existsSync(path)) {
      this.assertSafe(path);
      if (readFileSync(path, 'utf8') !== content)
        throw new Error('Pinned evidence artifact differs from its content identity');
      return;
    }
    writeFileSync(path, content, { mode: 0o400, flag: 'wx' });
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
