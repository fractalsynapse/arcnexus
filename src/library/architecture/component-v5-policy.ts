import { posix } from 'node:path';
import type { Catalog, Component } from './components.js';
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
    for (const key of ['role', 'executionProfile', 'testProfile'] as const) {
      const source = [...lineage].reverse().find((entry) => entry[key] !== undefined);
      if (!source) continue;
      component[key] = source[key]!;
      component.policy![key] = { value: source[key], source: source.id };
    }
  }

  /** Inherits each activity independently while recording the declaration that selected it. */
  private activities(component: Component, lineage: Component[]): void {
    const profiles: Record<string, string> = {};
    for (const declaration of lineage)
      for (const [activity, profile] of Object.entries(declaration.activityProfiles ?? {})) {
        if (!Object.hasOwn(this.authored.profiles, profile))
          throw new InputError(
            `Unknown activity execution profile for ${declaration.id}: ${profile}`,
          );
        profiles[activity] = profile;
        component.policy![`activityProfiles.${activity}`] = {
          value: profile,
          source: declaration.id,
        };
      }
    if (Object.keys(profiles).length) component.activityProfiles = profiles;
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
