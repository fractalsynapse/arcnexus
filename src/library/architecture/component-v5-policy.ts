import { posix } from 'node:path';
import type { Catalog, Component, ComponentActivity } from './components.js';
import { ancestry, covered, scopePath } from './component-paths.js';
import { InputError } from './config.js';

export interface ComponentV5Fields {
  activityProfiles?: Record<string, string>;
  standards?: string[];
  standardSnapshots?: Array<{
    id: string;
    artifacts: import('./references.js').ReferenceArtifact[];
  }>;
  definition?: { repository: string; path: string; sourceHash: string };
  observedImports?: import('./api-imports.js').ModuleRelationship[];
  observedConsumers?: import('./api-imports.js').ModuleRelationship[];
  publicApi?: import('./public-api.js').PublicSurface[];
  operationPlan?: Record<string, import('../operations/operations.js').Operation[]>;
  fileClassification?: import('./file-classification.js').FileClassification[];
  root?: string;
  owns?: string[];
  reads?: string[];
  api?: Array<{ module?: string; export?: string; schema?: string }>;
  operations?: Record<string, string[]>;
  classification?: import('./file-classification.js').FileClassification[];
  policy?: Record<
    string,
    { value: unknown; source: string | string[]; implicitOwnedPaths?: string[] }
  >;
  director?: { component: string; profile: string };
  reviewerProfile?: string;
  defaultPackage?: string;
  verificationInputs?: string[];
}

/** Resolves policy from original declarations without mutating ancestors during traversal. */
export class ComponentV5Policy {
  /** Keeps an isolated authored catalog for stable inheritance and declaration provenance. */
  constructor(private readonly authored: Catalog) {}

  /** Finds the nearest package and resolves relative paths in their declaring context. */
  root(component: Component): string {
    const owner = ancestry(this.authored, component.id)
      .reverse()
      .find((c) => c.type === 'package');
    const root = owner?.root ?? '.';
    scopePath(root);
    return root;
  }

  /** Anchors and validates a declaration before normalization could hide traversal. */
  path(component: Component, path: string): string {
    scopePath(path);
    return posix.join(this.root(component), path);
  }

  /** Applies nearest scalar policies, narrowed reads and mandatory accumulated intent. */
  apply(component: Component): void {
    const lineage = ancestry(this.authored, component.id);
    component.policy = {};
    this.scalars(component, lineage);
    this.activities(component, lineage);
    component.access = { readPaths: this.reads(lineage), writeDirectories: [] };
    component.policy.reads = {
      value: [...component.access.readPaths],
      source: [...lineage].reverse().find((entry) => entry.reads)?.id ?? component.id,
    };
    this.accumulate(component, lineage);
  }

  /** Captures the nearest explicit scalar declaration without inventing execution defaults. */
  private scalars(component: Component, lineage: Component[]): void {
    for (const key of ['executionProfile', 'testProfile'] as const) {
      const source = [...lineage].reverse().find((entry) => entry[key] !== undefined);
      if (!source) continue;
      component[key] = source[key]!;
      component.policy![key] = { value: source[key], source: source.id };
    }
  }

  /**
   * Resolves each declared activity, inheriting its role and profile from the nearest ancestor.
   *
   * A component states which activities it performs and the operations those activities may run;
   * the role holding an activity and the execution profile it runs under come from the nearest
   * ancestor that named them, so a platform can route `research` to a cheaper model once and every
   * component beneath it inherits that choice without re-declaring it. Operations are never
   * inherited: an activity may only run operations the component itself declares, because an
   * operation is executable authority tied to the paths this component owns.
   */
  private activities(component: Component, lineage: Component[]): void {
    const resolved: Record<string, ComponentActivity> = {};
    for (const [activity, declared] of Object.entries(component.activities ?? {})) {
      const author = [...lineage]
        .reverse()
        .find((entry) => entry.activities?.[activity] !== undefined);
      const inherited = author?.activities?.[activity];
      resolved[activity] = {
        ...inherited,
        ...declared,
        operations: declared?.operations ?? [],
      };
      component.policy![`activities.${activity}`] = {
        value: resolved[activity],
        source: author?.id ?? component.id,
      };
    }
    if (Object.keys(resolved).length) component.activities = resolved;
  }

  /** Records every contributing declaration while deduplicating required inherited policy values. */
  private accumulate(component: Component, lineage: Component[]): void {
    for (const key of [
      'constraints',
      component.schemaVersion === 6 ? 'standards' : 'patterns',
    ] as const) {
      component[key] = [...new Set(lineage.flatMap((entry) => entry[key] ?? []))];
      component.policy![key] = {
        value: [...component[key]],
        source: lineage.filter((entry) => entry[key]?.length).map((entry) => entry.id),
      };
    }
    component.operations = {};
    for (const declaration of lineage)
      for (const [id, usages] of Object.entries(declaration.operations ?? {}))
        component.operations[id] = [...new Set([...(component.operations[id] ?? []), ...usages])];
    component.policy!.operations = {
      value: structuredClone(component.operations),
      source: lineage
        .filter((entry) => Object.keys(entry.operations ?? {}).length)
        .map((entry) => entry.id),
    };
  }

  /** Rejects explicit read expansions while preserving the location of ancestor declarations. */
  private reads(lineage: Component[]): string[] {
    let boundary: string[] | undefined;
    for (const declaration of lineage) {
      if (!declaration.reads) continue;
      const paths = declaration.reads.map((p) => this.path(declaration, p));
      if (boundary && paths.some((p) => !covered(p, boundary!)))
        throw new InputError(`Read policy widens ancestor boundary: ${declaration.id}`);
      boundary = paths;
    }
    return boundary ?? [];
  }
}
