import { InputError } from './config.js';
import type { Catalog } from './components.js';

/**
 * Derives one deterministic order over the components of a catalog.
 *
 * Component iteration was already reproducible — `CatalogLoader` sorts the captured tree paths before
 * inserting definitions, so the same catalog always yields the same sequence — but that order is
 * alphabetical by file name and carries no meaning, which left any prioritized walk of the catalog to the
 * judgement of whoever was reading it. This derivation makes the order a property of the architecture:
 * containers before the components whose defaults they supply, the maintainer of the model files before the
 * components whose ownership declarations depend on it, then every remaining component only after the
 * components it relates to, with ties broken by identifier so the result is total and stable.
 */
export type SequencePhase = 'platform' | 'package' | 'model-maintainer' | 'component';

/** The catalog facts the derivation needs, kept narrow so the rules are testable without a full load. */
interface SequenceMember {
  id: string;
  type: string;
  parentId?: string;
  relatedIds: string[];
  allowedWritePaths: string[];
}

/** One component in the derived order, with the phase it was emitted in and what it waits on. */
export interface SequenceEntry {
  id: string;
  phase: SequencePhase;
  dependsOn: string[];
}

/** The model files whose maintainer must be examined before the components that reference it. */
const MODEL_ROOT = '.arc/architecture/';

/** Orders catalog components so a prioritized walk can be reproduced rather than asserted. */
export class ComponentSequence {
  private readonly members: SequenceMember[];

  /** Reads only the fields the derivation uses, so any catalog shape that carries them is accepted. */
  constructor(catalog: Catalog) {
    this.members = Object.values(catalog.components).map((component: any) => ({
      id: component.id,
      type: component.type,
      parentId: component.parentId,
      relatedIds: component.relatedIds ?? [],
      allowedWritePaths: component.allowedWritePaths ?? [],
    }));
  }

  /** Returns every component exactly once, in the derived order, with each entry's reason. */
  entries(): SequenceEntry[] {
    const entries: SequenceEntry[] = [];
    const emitted = new Set<string>();
    this.emitPlatform(entries, emitted);
    this.emitPackages(entries, emitted);
    this.emitModelMaintainer(entries, emitted);
    entries.push(...this.orderRemaining(emitted));
    const missing = this.members.filter((member) => !emitted.has(member.id));
    if (missing.length)
      throw new InputError(
        `Component sequence dropped: ${missing
          .map((m) => m.id)
          .sort()
          .join(', ')}`,
      );
    return entries;
  }

  /** Returns just the identifiers, in the same order `entries()` produces. */
  ids(): string[] {
    return this.entries().map((entry) => entry.id);
  }

  /** Places the single authoritative platform first, because every other default resolves through it. */
  private emitPlatform(entries: SequenceEntry[], emitted: Set<string>): void {
    const platforms = this.members
      .filter((member) => member.type === 'platform')
      .sort(byIdentifier);
    if (platforms.length !== 1)
      throw new InputError(
        'Component sequence requires exactly one platform; found ' + platforms.length,
      );
    entries.push({ id: platforms[0]!.id, phase: 'platform', dependsOn: [] });
    emitted.add(platforms[0]!.id);
  }

  /** Places containers next, parents before children, so a leaf's inherited defaults already exist. */
  private emitPackages(entries: SequenceEntry[], emitted: Set<string>): void {
    const pending = this.members.filter((member) => member.type === 'package').sort(byIdentifier);
    while (pending.length) {
      const index = pending.findIndex((member) => !member.parentId || emitted.has(member.parentId));
      if (index < 0) throw new InputError('Component sequence found a package without its parent');
      const member = pending.splice(index, 1)[0]!;
      entries.push({ id: member.id, phase: 'package', dependsOn: this.waitFor(member, emitted) });
      emitted.add(member.id);
    }
  }

  /**
   * Places the maintainer of the shared model files before the components that read its declarations.
   *
   * Ownership, roles, operations and profiles are authored in the model root, so an audit of any leaf is
   * provisional until the owner of those files has been examined. Selection is mechanical: the component
   * holding the most paths under the model root, ties broken by identifier, so no name is special-cased.
   * The preference never outranks a real dependency: a maintainer that relates to a component not yet emitted
   * stays where the topological order puts it, because otherwise this override would silently break a
   * relation cycle the sequence is required to refuse.
   */
  private emitModelMaintainer(entries: SequenceEntry[], emitted: Set<string>): void {
    const candidates = this.leaves()
      .filter((member) => !emitted.has(member.id))
      .map((member) => ({ member, held: this.modelPaths(member) }))
      .filter((entry) => entry.held > 0)
      .sort((a, b) => b.held - a.held || byIdentifier(a.member, b.member));
    const candidate = candidates[0];
    if (!candidate) return;
    const member = candidate.member;
    const known = new Set(this.leaves().map((candidate) => candidate.id));
    const blocked = this.related(member).filter((id) => known.has(id) && !emitted.has(id));
    if (blocked.length) return;
    entries.push({
      id: member.id,
      phase: 'model-maintainer',
      dependsOn: this.waitFor(member, emitted),
    });
    emitted.add(member.id);
  }

  /** Emits the remaining components, each only after every component it relates to has been placed. */
  private orderRemaining(emitted: Set<string>): SequenceEntry[] {
    const output: SequenceEntry[] = [];
    const pending = new Map(this.leaves().map((member) => [member.id, member]));
    for (const member of [...pending.values()])
      if (emitted.has(member.id)) pending.delete(member.id);
    while (pending.size) {
      const ready = [...pending.values()]
        .filter((member) => this.related(member).every((id) => emitted.has(id) || !pending.has(id)))
        .map((member) => member.id)
        .sort();
      if (!ready.length)
        throw new InputError(
          `Component sequence has a cycle among: ${[...pending.keys()].sort().join(', ')}`,
        );
      const member = pending.get(ready[0]!)!;
      pending.delete(member.id);
      output.push({ id: member.id, phase: 'component', dependsOn: this.waitFor(member, emitted) });
      emitted.add(member.id);
    }
    return output;
  }

  /** Every component except the platform, which is never a dependent. */
  private leaves(): SequenceMember[] {
    return this.members.filter((member) => member.type !== 'platform').sort(byIdentifier);
  }

  /** The authored relations the order respects; containers are already emitted, so they are dropped. */
  private related(member: SequenceMember): string[] {
    return [
      ...new Set([...(member.relatedIds ?? []), ...(member.parentId ? [member.parentId] : [])]),
    ];
  }

  /** The already-emitted dependencies of a member, reported so a reader can see why it sits here. */
  private waitFor(member: SequenceMember, emitted: Set<string>): string[] {
    return this.related(member)
      .filter((id) => emitted.has(id))
      .sort();
  }

  /** Counts how many owned paths fall under the shared model root. */
  private modelPaths(member: SequenceMember): number {
    return member.allowedWritePaths.filter((path) => path.startsWith(MODEL_ROOT)).length;
  }
}

/** Orders two members by identifier, the tie-break that makes the whole derivation reproducible. */
const byIdentifier = (a: SequenceMember, b: SequenceMember): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
