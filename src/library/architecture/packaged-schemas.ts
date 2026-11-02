import { readFileSync } from 'node:fs';

/** Expands references only between trusted schemas packaged with the supervising application. */
export class PackagedSchemas {
  private readonly registry: Record<string, string>;

  private readonly base = new URL('./schema-registry.json', import.meta.url);

  /** Reads the immutable application registry, never the target project's schema declarations. */
  constructor() {
    this.registry = JSON.parse(readFileSync(this.base, 'utf8'));
  }

  /** Returns a fresh expanded contract suitable for both validation and model output restrictions. */
  read(name: string): any {
    if (!Object.hasOwn(this.registry, name)) throw new Error(`Unknown runtime schema: ${name}`);
    return this.file(new URL(this.registry[name]!, this.base), []);
  }

  /** Rejects unregistered files and cycles before reading a referenced schema. */
  private file(url: URL, parents: string[]): any {
    if (!Object.values(this.registry).some((path) => new URL(path, this.base).href === url.href))
      throw new Error(`Unregistered runtime schema reference: ${url.href}`);
    if (parents.includes(url.href)) throw new Error('Runtime schema reference cycle');
    return this.expand(JSON.parse(readFileSync(url, 'utf8')), url, [...parents, url.href]);
  }

  /** Resolves relative file references without remote loading, overlays or ambiguous external fragments. */
  private expand(value: any, base: URL, parents: string[]): any {
    if (Array.isArray(value)) return value.map((entry) => this.expand(entry, base, parents));
    if (!value || typeof value !== 'object') return value;
    if (typeof value.$ref === 'string' && !value.$ref.startsWith('#'))
      return this.reference(value, base, parents);
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, this.expand(entry, base, parents)]),
    );
  }

  /** Validates a single external reference before expanding its registered local definition. */
  private reference(value: { $ref: string }, base: URL, parents: string[]): any {
    const reference = value.$ref;
    const registered = this.identity(reference);
    if (
      Object.keys(value).length !== 1 ||
      reference.includes('#') ||
      (!registered && (reference.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(reference)))
    )
      throw new Error(`Unsupported runtime schema reference: ${reference}`);
    const resolved = this.file(registered ?? new URL(reference, base), parents);
    delete resolved.$id;
    return resolved;
  }

  /** Resolves declared schema identities exclusively from local registry files without fetching URLs. */
  private identity(reference: string): URL | undefined {
    for (const path of Object.values(this.registry)) {
      const url = new URL(path, this.base);
      if (JSON.parse(readFileSync(url, 'utf8')).$id === reference) return url;
    }
    return undefined;
  }
}
