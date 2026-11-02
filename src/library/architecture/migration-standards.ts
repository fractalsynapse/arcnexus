import type { ConfigurationSource } from './configuration.js';
import { validateSchema } from './schema.js';

/** Maps only the retired standard-definition location, preserving every other source path. */
export function standardPath(path: string): string {
  return path.replace(/^architecture\/patterns(?=\/|$)/, 'architecture/standards');
}

/** Converts the final minimal migration draft without rewriting historical evidence or artifact contents. */
export class StandardsMigration {
  /** Retains captured source definitions and the preceding authority-preserving recipe conversion. */
  constructor(
    private readonly sources: ConfigurationSource[],
    private readonly files: Map<string, unknown | null>,
  ) {}

  /** Rejects conflicting destinations before moving definitions and their exact authored ownership paths. */
  create(): Map<string, unknown | null> {
    for (const source of this.sources) {
      if (source.path.startsWith('architecture/components/')) this.component(source);
      if (source.path.startsWith('architecture/patterns/')) this.standard(source);
    }
    return this.files;
  }

  /** Renames authored policy once and validates that retired fields cannot remain executable. */
  private component(source: ConfigurationSource): void {
    const value = structuredClone(this.files.get(source.path) ?? source.value) as Record<
      string,
      any
    >;
    if (value.schemaVersion === 6) return;
    if (value.schemaVersion !== 5)
      throw new Error('Standards migration requires minimal components');
    validateSchema('component-v5', value);
    value.schemaVersion = 6;
    if (value.patterns !== undefined) value.standards = value.patterns;
    delete value.patterns;
    for (const key of ['owns', 'reads']) if (value[key]) value[key] = value[key].map(standardPath);
    this.files.set(source.path, validateSchema('component-v6', value));
  }

  /** Preserves standard identity/checks and refuses to overwrite a separately authored destination. */
  private standard(source: ConfigurationSource): void {
    const destination = standardPath(source.path);
    if (this.sources.some((entry) => entry.path === destination) || this.files.has(destination))
      throw new Error('Conflicting standard migration destination: ' + destination);
    const value = structuredClone(this.files.get(source.path) ?? source.value);
    this.files.set(destination, validateSchema('standard', value));
    this.files.set(source.path, null);
  }
}
