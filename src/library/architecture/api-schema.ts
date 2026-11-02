import { posix } from 'node:path';
import { RevisionArtifacts } from './revision-artifacts.js';
import { scopePath } from './component-paths.js';

export interface SchemaSurface {
  path: string;
  sha256: string;
  identity?: string;
  references: Array<{ from: string; reference: string; target?: string; sha256?: string }>;
}

/** Validates local schema links from captured artifacts while retaining unresolved external references. */
export class ApiSchema {
  private readonly documents = new Map<string, any>();

  private readonly references: SchemaSurface['references'] = [];

  /** Binds reference traversal to one repository's immutable source revision. */
  constructor(private readonly artifacts: RevisionArtifacts) {}

  /** Captures the schema identity and checks its complete reachable local reference graph. */
  inspect(path: string): SchemaSurface {
    const artifact = this.artifacts.read(path);
    const schema = this.document(path);
    return {
      path,
      sha256: artifact.sha256,
      ...(typeof schema?.$id === 'string' ? { identity: schema.$id } : {}),
      references: [...this.references],
    };
  }

  /** Reads each schema once, allowing recursive schemas without silently accepting missing files. */
  private document(path: string): any {
    if (this.documents.has(path)) return this.documents.get(path);
    scopePath(path);
    const value = JSON.parse(this.artifacts.read(path).text);
    if (typeof value !== 'boolean' && (!value || typeof value !== 'object' || Array.isArray(value)))
      throw new Error(`Invalid schema artifact: ${path}`);
    this.documents.set(path, value);
    this.walk(value, path);
    return value;
  }

  /** Locates references throughout schema keywords without treating external URLs as fetched evidence. */
  private walk(value: any, path: string): void {
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string') this.reference(value.$ref, path);
    for (const child of Object.values(value)) this.walk(child, path);
  }

  /** Resolves relative file references and validates referenced local JSON pointers. */
  private reference(reference: string, from: string): void {
    if (/^[a-z][a-z0-9+.-]*:/i.test(reference) || reference.startsWith('//')) {
      this.references.push({ from, reference });
      return;
    }
    const [file, fragment] = reference.split('#');
    if (file?.startsWith('/')) throw new Error(`Unsafe schema reference: ${reference}`);
    const target = file
      ? posix.normalize(posix.join(posix.dirname(from), decodeURIComponent(file)))
      : from;
    scopePath(target);
    const value = this.document(target);
    if (fragment) this.fragment(value, fragment, reference);
    this.references.push({ from, reference, target, sha256: this.artifacts.read(target).sha256 });
  }

  /** Rejects missing pointer targets instead of advertising an unusable schema relationship. */
  private fragment(value: any, fragment: string, reference: string): void {
    const decoded = decodeURIComponent(fragment);
    if (!decoded.startsWith('/'))
      throw new Error(`Unsupported schema reference anchor: ${reference}`);
    for (const token of decoded.slice(1).split('/')) {
      const key = token.replaceAll('~1', '/').replaceAll('~0', '~');
      if (!value || typeof value !== 'object' || !Object.hasOwn(value, key))
        throw new Error(`Missing schema reference target: ${reference}`);
      value = value[key];
    }
  }
}
