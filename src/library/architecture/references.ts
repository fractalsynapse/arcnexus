import { RevisionArtifacts } from './revision-artifacts.js';
import { posix } from 'node:path';
import type { Catalog, Component } from './components.js';
import { relativePath } from './config.js';
import { ConfigurationReader, isConfiguration } from './configuration.js';
import { git } from '../operations/process.js';
import { validateSchema } from './schema.js';

export interface ContractDefinition {
  id: string;
  version: string;
  kind: 'json-schema' | 'typescript';
  path: string;
  compatibility: string;
}

export interface ReferenceArtifact {
  path: string;
  text: string;
  sha256: string;
}

interface GuidanceDefinition {
  schemaVersion: 1;
  id: string;
  owner: string;
  purpose: string;
  applicability: string;
  document: string;
  examples: string[];
  operationIds: string[];
}

/** Captures referenced guidance and contracts without adding execution authority. */
export class ArchitectureReferences {
  /** Pins pattern and contract resolution to the catalog and its captured revision. */
  constructor(
    private readonly repository: string,
    private readonly base: string,
    private readonly catalog: Catalog,
  ) {}

  /** Reads every committed standard, including unused entries, through the existing authority checks. */
  standards() {
    const paths = git(
      this.repository,
      'ls-tree',
      '-r',
      '--name-only',
      this.base,
      '--',
      '.arc/architecture/standards',
    )
      .trim()
      .split('\n')
      .filter(isConfiguration);
    const ids = paths.map((path) =>
      path.slice('.arc/architecture/standards/'.length).replace(/\.(json|ya?ml)$/, ''),
    );
    return [...new Set(ids)].sort().map((id) => this.standard(id));
  }

  /** Resolves captured inputs and rejects unsupported or inconsistent configuration. */
  resolve(): void {
    const standards = this.capturedStandards();
    for (const component of Object.values(this.catalog.components)) {
      if (component.schemaVersion === 6) {
        component.standardSnapshots = (component.standards ?? []).map((id) => {
          const standard = standards.get(id);
          if (!standard) throw new Error('Missing standard: ' + id);
          return standard;
        });
        continue;
      }
    }
  }

  /** Captures each standard once, including declarations without current consumers. */
  private capturedStandards() {
    if (Object.values(this.catalog.components).some((component) => component.schemaVersion === 6))
      this.catalog.standards = this.standards();
    return new Map(this.catalog.standards?.map((standard) => [standard.id, standard]));
  }

  /**
   * Reads one captured standard and proves its checks belong to the owning component.
   *
   * A standard names operations that must exist in its owner's declared bindings; guidance paths
   * resolve through that owner's repository, so a standard cannot reach outside its own authority.
   */
  private standard(id: string) {
    relativePath(id);
    if (id.includes('/')) throw new Error(`Invalid standard identity: ${id}`);
    const source = new ConfigurationReader().definition(
      this.repository,
      this.base,
      `.arc/architecture/standards/${id}`,
    );
    const standard = validateSchema<GuidanceDefinition>('standard', source.value);
    if (standard.id !== id) throw new Error(`Standard identity mismatch: ${id}`);
    const owner = this.catalog.components[standard.owner];
    if (!owner) throw new Error(`Missing standard owner: ${standard.owner}`);
    for (const operation of standard.operationIds)
      if (!owner.operations?.[operation]?.length)
        throw new Error(`Standard check outside owner's operations: ${operation}`);
    if (!this.catalog.configurationSources.some((entry) => entry.path === source.path))
      this.catalog.configurationSources.push(source);
    const artifacts = [standard.document, ...standard.examples].map((path) =>
      this.artifact(this.ownedPath(owner, path), owner.repository),
    );
    if (artifacts.some((artifact) => !artifact))
      throw new Error(`Standard requires repository binding: ${standard.owner}`);
    return { ...standard, artifacts: artifacts as ReferenceArtifact[] };
  }

  /** Checks whether the path belongs to the current owner’s captured scope. */
  private ownedPath(owner: Component, path: string): string {
    relativePath(path);
    const resolved = posix.join(owner.repositoryRoot ?? '.', path);
    if (
      !owner.allowedWritePaths.some(
        (p) => p === '.' || resolved === p || resolved.startsWith(p + '/'),
      )
    )
      throw new Error(`Reference outside owner: ${owner.id}: ${resolved}`);
    return resolved;
  }

  /** Captures referenced content and its digest without granting additional authority. */
  private artifact(path: string, repository: string): ReferenceArtifact | undefined {
    const revision = this.catalog.repositoryRevisions?.[repository];
    if (!revision) return undefined;
    return new RevisionArtifacts(revision.source, revision.base).read(path);
  }
}
