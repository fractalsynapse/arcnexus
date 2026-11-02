import { createHash } from 'node:crypto';
import { validateSchema } from './schema.js';

interface Definition {
  schemaVersion: number;
  id: string;
  purpose: string;
  kind: 'command' | 'service' | 'http';
  repository: string;
  cwd: string;
  category: string;
  activities: string[];
  generatedDirectories: string[];
  artifacts: string[];
  prerequisites?: string[];
  probes?: Array<{ command: string; args: string[] }>;
  http?: { serviceId: string; [key: string]: unknown };
  [key: string]: unknown;
}

/** Converts executable definitions by full semantics and retains a complete reference identity map. */
export class MigrationOperations {
  private readonly source = new Map<string, Definition>();

  private readonly identities = new Map<string, string>();

  private readonly definitions = new Map<string, Definition>();

  private readonly semantics = new Map<string, string>();

  private readonly active = new Set<string>();

  /** Validates authored inputs without mutating them or accepting obsolete execution deadlines. */
  constructor(definitions: unknown[]) {
    for (const value of definitions) {
      const entry = structuredClone(value) as Definition;
      if (entry && Object.hasOwn(entry, 'timeoutSeconds'))
        throw new Error('Remove obsolete operation timeoutSeconds before migration');
      if (![3, 4].includes(entry?.schemaVersion))
        throw new Error('Operation migration requires schemaVersion 3 or 4');
      validateSchema(entry.schemaVersion === 4 ? 'operation-v4' : 'operation', entry);
      if (this.source.has(entry.id)) throw new Error('Duplicate operation identity: ' + entry.id);
      this.source.set(entry.id, entry);
    }
  }

  /** Resolves dependencies before comparison and returns isolated, deterministically ordered definitions. */
  convert(): { definitions: Definition[]; identities: Record<string, string> } {
    for (const id of [...this.source.keys()].sort()) this.visit(id);
    return {
      definitions: structuredClone(
        [...this.definitions.values()].sort((a, b) => a.id.localeCompare(b.id)),
      ),
      identities: Object.fromEntries(
        [...this.identities.entries()].sort(([a], [b]) => a.localeCompare(b)),
      ),
    };
  }

  /** Detects missing definitions and cycles before a migration can expose a partially rewritten graph. */
  private visit(id: string): string {
    const retained = this.identities.get(id);
    if (retained) return retained;
    if (this.active.has(id)) throw new Error('Operation migration prerequisite cycle: ' + id);
    const source = this.source.get(id);
    if (!source) throw new Error('Missing operation migration reference: ' + id);
    this.active.add(id);
    const entry = this.normalize(source);
    entry.prerequisites = (source.prerequisites ?? []).map((dependency) => this.visit(dependency));
    entry.prerequisites.push(...(source.probes ?? []).map((probe) => this.probe(source, probe)));
    if (entry.http) entry.http.serviceId = this.visit(entry.http.serviceId);
    const result = this.retain(entry);
    this.identities.set(id, result);
    this.active.delete(id);
    return result;
  }

  /** Removes retired wrappers while retaining every executable field and meaningful list ordering. */
  private normalize(source: Definition): Definition {
    const entry = structuredClone(source);
    entry.schemaVersion = 4;
    delete entry.probes;
    if (entry.network === false) delete entry.network;
    entry.activities = [...entry.activities].sort();
    entry.generatedDirectories = [...entry.generatedDirectories].sort();
    entry.artifacts = [...entry.artifacts].sort();
    return entry;
  }

  /** Extracts a probe in its parent's exact repository, working directory and operation policy. */
  private probe(parent: Definition, command: { command: string; args: string[] }): string {
    const entry: Definition = {
      schemaVersion: 4,
      id: 'pending',
      purpose: 'Check prerequisite for ' + parent.id,
      kind: 'command',
      repository: parent.repository,
      cwd: parent.cwd,
      category: parent.category,
      activities: [...parent.activities],
      generatedDirectories: [...parent.generatedDirectories],
      artifacts: [...parent.artifacts],
      ...(parent.network === true ? { network: true } : {}),
      prerequisites: [],
      ...command,
    };
    const normalized = this.normalize(entry);
    normalized.id = 'migrated-probe-' + this.digest(normalized).slice(0, 16);
    return this.reserveProbe(normalized);
  }

  /** Reuses a previously migrated probe only when its authored definition has identical semantics. */
  private reserveProbe(entry: Definition): string {
    if (!this.source.has(entry.id)) return this.retain(entry);
    const id = this.visit(entry.id);
    if (this.digest(this.definitions.get(id)!) !== this.digest(entry))
      throw new Error(
        'Generated operation identity conflicts with authored definition: ' + entry.id,
      );
    return id;
  }

  /** Deduplicates only after resolving context and prerequisite identities, retaining the first stable ID. */
  private retain(entry: Definition): string {
    validateSchema('operation-v4', entry);
    const key = this.digest(entry);
    const existing = this.semantics.get(key);
    if (existing) return existing;
    if (this.definitions.has(entry.id))
      throw new Error(
        'Generated operation identity conflicts with authored definition: ' + entry.id,
      );
    this.definitions.set(entry.id, entry);
    this.semantics.set(key, entry.id);
    return entry.id;
  }

  /** Excludes display identity and description while comparing all execution fields recursively. */
  private digest(entry: Definition): string {
    const { id: _id, purpose: _purpose, ...execution } = entry;
    return createHash('sha256')
      .update(
        JSON.stringify(
          this.canonical({
            ...execution,
            ...(entry.kind === 'service' ? { leaseIdentity: entry.id } : {}),
          }),
        ),
      )
      .digest('hex');
  }

  /** Normalizes object key ordering without reordering argv or prerequisite execution. */
  private canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => this.canonical(entry));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, this.canonical(entry)]),
      );
    return value;
  }
}
