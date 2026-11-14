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
  definitionPath?: string;
}

/** One component in the derived order, with the phase it was emitted in and what it waits on. */
export interface SequenceEntry {
  id: string;
  phase: SequencePhase;
  dependsOn: string[];
}

/**
 * The component type layers, lowest first.
 *
 * Foundation standards precede the gateway that ships them, the libraries precede the release that
 * publishes them, and this matches the documented contract walk (project -> foundation -> gateway ->
 * libraries -> release). Every list of components in the product is expected to follow this layering, so
 * the rank is exported rather than kept private to the sequence.
 */
export const componentTypeOrder = ['foundation', 'gateway', 'library', 'release'];

/** Rank of a component type within {@link componentTypeOrder}; unknown types sort last, then by identifier. */
export function componentTypeRank(type: string): number {
  const rank = componentTypeOrder.indexOf(type);
  return rank < 0 ? componentTypeOrder.length : rank;
}

/** Knowledge-root files whose maintainer must be examined before the components that reference them. */
const KNOWLEDGE_ROOT = '.arc/';

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
      definitionPath: component.definition?.path,
    }));
  }

  /** Returns every component exactly once, in the derived order, with each entry's reason. */
  entries(): SequenceEntry[] {
    const entries: SequenceEntry[] = [];
    const emitted = new Set<string>();
    this.emitPlatform(entries, emitted);
    this.emitPackages(entries, emitted);
    this.emitModelMaintainers(entries, emitted);
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
   * Places every component that holds knowledge-root content, before the components reading through it.
   *
   * `.arc/` is loaded ahead of the regular components: the model, its ownership declarations, roles,
   * operations, every profile directory, the plan template and the agent-authored plan and learning spaces
   * all live under it. A component holding any of that content is a maintainer of it, so the phase lists
   * **every** holder rather than the largest — this catalog has four, and one project choosing to concentrate
   * them in a single component is not a universal rule. Holders never reappear in the type list, and they
   * are ordered by the same type layer as everything else, then by how much they hold, then by identifier.
   *
   * A component's own definition is excluded: it sits under `.arc/architecture/components/`, and counting it
   * would place all 21 owners in this phase and empty the type list entirely. Holding knowledge content
   * *for others* is the signal. A holder still waits on its relations, so a mutual relation between two
   * holders is refused instead of being resolved by the preference.
   */
  private emitModelMaintainers(entries: SequenceEntry[], emitted: Set<string>): void {
    const pending = new Map(
      this.leaves()
        .filter((member) => this.knowledgeContentPaths(member).length > 0)
        .map((member) => [member.id, member]),
    );
    while (pending.size) {
      const ready = [...pending.values()].filter((member) =>
        this.related(member).every((id) => emitted.has(id) || !pending.has(id)),
      );
      if (!ready.length)
        throw new InputError(
          `Component sequence has a cycle among: ${[...pending.keys()].sort().join(', ')}`,
        );
      ready.sort(
        (a, b) =>
          componentTypeRank(a.type) - componentTypeRank(b.type) ||
          this.held(b) - this.held(a) ||
          byIdentifier(a, b),
      );
      const member = ready[0]!;
      pending.delete(member.id);
      entries.push({
        id: member.id,
        phase: 'model-maintainer',
        dependsOn: this.waitFor(member, emitted),
      });
      emitted.add(member.id);
    }
  }

  /** Emits the remaining components by type layer, each only after every component it relates to. */
  private orderRemaining(emitted: Set<string>): SequenceEntry[] {
    const output: SequenceEntry[] = [];
    const pending = new Map(this.leaves().map((member) => [member.id, member]));
    for (const member of [...pending.values()])
      if (emitted.has(member.id)) pending.delete(member.id);
    while (pending.size) {
      const ready = [...pending.values()]
        .filter((member) => this.related(member).every((id) => emitted.has(id) || !pending.has(id)))
        .sort(byTypeLayer);
      if (!ready.length)
        throw new InputError(
          `Component sequence has a cycle among: ${[...pending.keys()].sort().join(', ')}`,
        );
      const member = ready[0]!;
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

  /** Knowledge-root paths this component holds. */
  private knowledgeContentPaths(member: SequenceMember): string[] {
    // No exclusion is needed any more: a component's own profile belongs to the steward of
    // `.arc/architecture`, not to its subject, so every `.arc/` path a component holds is content it
    // maintains for others. That separation is what this phase is meant to recognise.
    return member.allowedWritePaths.filter((path) => path.startsWith(KNOWLEDGE_ROOT));
  }

  /** How much knowledge-root content a component holds, the ordering signal inside the phase. */
  private held(member: SequenceMember): number {
    return this.knowledgeContentPaths(member).length;
  }
}

/** Orders members by component type layer, then by identifier for full determinism. */
const byTypeLayer = (a: SequenceMember, b: SequenceMember): number =>
  componentTypeRank(a.type) - componentTypeRank(b.type) || byIdentifier(a, b);

/** Orders two members by identifier, the tie-break that makes the whole derivation reproducible. */
const byIdentifier = (a: SequenceMember, b: SequenceMember): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
