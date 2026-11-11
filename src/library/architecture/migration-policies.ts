import { posix } from 'node:path';

interface Declaration {
  id: string;
  type: string;
  parentId?: string;
  root?: string;
  repository?: string;
  role?: string;
  executionProfile?: string;
  testProfile?: string;
  reads?: string[];
  operations?: Record<string, string[]>;
  constraints?: string[];
  patterns?: string[];
  [key: string]: unknown;
}

type Scalar = 'executionProfile' | 'testProfile';

/** Reduces authored policy without changing effective execution authority or local architectural facts. */
export class MigrationPolicies {
  private readonly declarations: Record<string, Declaration>;

  /** Clones declarations so a rejected migration cannot mutate the captured source catalog. */
  constructor(
    declarations: Record<string, Declaration>,
    private readonly primary: string,
  ) {
    this.declarations = structuredClone(declarations);
  }

  /** Moves only universally shared child policy, then removes redundant inherited declarations. */
  reduce(): Record<string, Declaration> {
    const ordered = Object.values(this.declarations).sort(
      (a, b) => this.lineage(b).length - this.lineage(a).length,
    );
    for (const parent of ordered) {
      const children = ordered.filter((child) => child.parentId === parent.id);
      if (!children.length) continue;
      for (const key of ['executionProfile', 'testProfile'] as const)
        this.scalar(parent, children, key);
      this.reads(parent, children);
      this.operations(parent, children);
    }
    for (const child of ordered.reverse()) this.prune(child);
    return this.declarations;
  }

  /** Validates ancestry rather than allowing malformed input to loop or silently lose policy. */
  private lineage(component: Declaration): Declaration[] {
    const result: Declaration[] = [];
    let current: Declaration | undefined = component;
    while (current) {
      if (result.includes(current)) throw new Error('Cyclic migration ancestry: ' + component.id);
      result.unshift(current);
      const parent: string | undefined = current.parentId;
      current = parent ? this.declarations[parent] : undefined;
      if (parent && !current) throw new Error('Missing migration ancestor: ' + parent);
    }
    return result;
  }

  /** Preserves an explicit container value even when all its descendants override it. */
  private scalar(parent: Declaration, children: Declaration[], key: Scalar): void {
    const value = children[0]![key];
    if (parent[key] === undefined && value !== undefined && children.every((c) => c[key] === value))
      parent[key] = value;
    for (const child of children)
      if (child[key] !== undefined && child[key] === parent[key]) delete child[key];
  }

  /** Resolves package location before comparing equal-looking relative read paths. */
  private location(component: Declaration): { root: string; repository: string } {
    const owner = this.lineage(component).findLast((entry) => entry.type === 'package');
    return { root: owner?.root ?? '.', repository: owner?.repository ?? this.primary };
  }

  /** Compares unordered read grants only after anchoring them to their declaring repository. */
  private readIdentity(component: Declaration): string | undefined {
    if (!component.reads) return undefined;
    const { root, repository } = this.location(component);
    return JSON.stringify({
      repository,
      paths: [...new Set(component.reads.map((path) => posix.join(root, path)))].sort(),
    });
  }

  /** Hoists readable paths only when their new spelling is valid in the parent's package context. */
  private reads(parent: Declaration, children: Declaration[]): void {
    const first = children[0]!;
    const identity = this.readIdentity(first);
    if (!parent.reads && identity && children.every((c) => this.readIdentity(c) === identity)) {
      const from = this.location(first);
      const to = this.location(parent);
      const paths = first.reads!.map(
        (p) => posix.relative(to.root, posix.join(from.root, p)) || '.',
      );
      if (
        from.repository === to.repository &&
        paths.every((p) => p !== '..' && !p.startsWith('../'))
      )
        parent.reads = paths;
    }
    for (const child of children)
      if (child.reads && this.readIdentity(child) === this.readIdentity(parent)) delete child.reads;
  }

  /** Intersects usages rather than broadening availability based merely on a shared operation ID. */
  private operations(parent: Declaration, children: Declaration[]): void {
    for (const [id, usages] of Object.entries(children[0]!.operations ?? {})) {
      const common = usages.filter((usage) =>
        children.every((child) => child.operations?.[id]?.includes(usage)),
      );
      if (!common.length) continue;
      parent.operations ??= {};
      parent.operations[id] = [...new Set([...(parent.operations[id] ?? []), ...common])];
      for (const child of children) {
        child.operations![id] = child.operations![id]!.filter((usage) => !common.includes(usage));
        if (!child.operations![id]!.length) delete child.operations![id];
        this.omitEmptyOperations(child);
      }
    }
  }

  /** Removes explicit duplicates already supplied by ancestors without moving objectives or ownership. */
  private prune(child: Declaration): void {
    const ancestors = this.lineage(child).slice(0, -1);
    for (const key of ['executionProfile', 'testProfile'] as const) {
      const inherited = ancestors.findLast((ancestor) => ancestor[key] !== undefined)?.[key];
      if (child[key] !== undefined && child[key] === inherited) delete child[key];
    }
    const reader = ancestors.findLast((ancestor) => ancestor.reads !== undefined);
    if (reader && child.reads && this.readIdentity(reader) === this.readIdentity(child))
      delete child.reads;
    for (const key of ['constraints', 'patterns'] as const) {
      const inherited = ancestors.flatMap((ancestor) => ancestor[key] ?? []);
      if (child[key]) child[key] = child[key].filter((value) => !inherited.includes(value));
      if (!child[key]?.length) delete child[key];
    }
    this.pruneOperations(child, ancestors);
  }

  /** Removes inherited usages independently so a local agent-only override remains explicit. */
  private pruneOperations(child: Declaration, ancestors: Declaration[]): void {
    for (const [id, usages] of Object.entries(child.operations ?? {})) {
      const inherited = ancestors.flatMap((ancestor) => ancestor.operations?.[id] ?? []);
      child.operations![id] = usages.filter((usage) => !inherited.includes(usage));
      if (!child.operations![id]!.length) delete child.operations![id];
    }
    this.omitEmptyOperations(child);
  }

  /** Keeps minimal declarations free of empty maps introduced by policy reduction. */
  private omitEmptyOperations(component: Declaration): void {
    if (component.operations && !Object.keys(component.operations).length)
      delete component.operations;
  }
}
