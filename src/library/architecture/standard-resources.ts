import { ancestry, loadCatalog } from './components.js';
import { loadProjectBindings } from './bindings.js';
import { ArchitectureReferences } from './references.js';
import { InputError } from './config.js';
import { ResourceQuery, type ResourceQueryInput } from '../report/resource-query.js';

export interface StandardResourceTarget {
  source: string;
  base: string;
  platformId: string;
}

/** Projects the complete committed standards library without executing checks or granting authority. */
export class StandardResources {
  private readonly query = new ResourceQuery();

  /** Lists standards owned within the selected platform using shared typed queries and revision cursors. */
  list(target: StandardResourceTarget, input: ResourceQueryInput = {}) {
    return this.query.page(this.items(target), { id: null, owner: null }, input, ['id', 'purpose']);
  }

  /** Rejects missing or foreign identities without exposing another platform's standard resource. */
  get(target: StandardResourceTarget, id: string) {
    const item = this.items(target).find((entry) => entry.id === id);
    if (!item) throw new InputError('Unknown or out-of-platform standard: ' + id);
    return item;
  }

  /** Resolves frozen declarations and validates unused guidance through the catalog's reference machinery. */
  private items(target: StandardResourceTarget) {
    try {
      for (const key of ['source', 'base', 'platformId'] as const)
        if (typeof target[key] !== 'string' || !target[key].trim())
          throw new InputError('Invalid standard resource target: ' + key);
      const catalog = loadCatalog(target.source, target.base, loadProjectBindings(target.source));
      const platform = catalog.components[target.platformId];
      if (!platform || platform.type !== 'platform')
        throw new InputError('Unknown selected platform');
      if (platform.schemaVersion !== 6)
        throw new InputError('Migrate platform configuration before reading standards');
      return new ArchitectureReferences(target.source, target.base, catalog)
        .standards()
        .filter((entry) => ancestry(catalog, entry.owner).some((owner) => owner.id === platform.id))
        .map(({ artifacts, ...definition }) => ({
          ...structuredClone(definition),
          revision: this.query.revision({
            base: target.base,
            definition,
            artifacts: artifacts.map(({ path, sha256 }) => ({ path, sha256 })),
          }),
        }));
    } catch (error) {
      throw error instanceof InputError ? error : new InputError(String(error));
    }
  }
}
