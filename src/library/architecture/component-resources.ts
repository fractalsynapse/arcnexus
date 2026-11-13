import { ancestry, loadCatalog, type Catalog, type Component } from './components.js';
import { loadProjectBindings } from './bindings.js';
import { InputError } from './config.js';
import { readSchema } from './schema.js';
import { ResourceQuery, type ResourceQueryInput } from '../report/resource-query.js';

export interface ComponentResourceTarget {
  source: string;
  base: string;
  packageId: string;
}

/** Projects captured component intent without exposing executable policy or creating run state. */
export class ComponentResources {
  private readonly query = new ResourceQuery();

  /** Lists the selected package and descendants using the shared typed query and cursor contract. */
  list(target: ComponentResourceTarget, input: ResourceQueryInput = {}) {
    const catalog = this.catalog(target);
    const items = Object.keys(catalog.components)
      .sort()
      .filter((id) => this.contains(catalog, target.packageId, id))
      .map((id) => this.project(catalog.components[id]!, target.base));
    const types: string[] = readSchema('component').oneOf.flatMap(
      (entry: any) => entry.properties.type.enum,
    );
    return this.query.page(items, { id: null, type: types, parentId: null }, input, [
      'id',
      'purpose',
    ]);
  }

  /** Reads one in-scope component and rejects missing identities or foreign package membership. */
  get(target: ComponentResourceTarget, componentId: string) {
    const catalog = this.catalog(target);
    if (!Object.hasOwn(catalog.components, componentId))
      throw new InputError('Unknown component: ' + componentId);
    if (!this.contains(catalog, target.packageId, componentId))
      throw new InputError('Component is outside the selected package: ' + componentId);
    return this.project(catalog.components[componentId]!, target.base);
  }

  /** Loads committed source and local bindings without materializing execution storage or a host. */
  private catalog(target: ComponentResourceTarget): Catalog {
    for (const key of ['source', 'base', 'packageId'] as const)
      if (typeof target[key] !== 'string' || !target[key].trim())
        throw new InputError('Invalid component resource target: ' + key);
    const catalog = loadCatalog(target.source, target.base, loadProjectBindings(target.source));
    if (
      !Object.hasOwn(catalog.components, target.packageId) ||
      catalog.components[target.packageId]!.type !== 'package'
    )
      throw new InputError('Unknown selected package: ' + target.packageId);
    return catalog;
  }

  /** Uses catalog ancestry, including the selected root, rather than path or name heuristics. */
  private contains(catalog: Catalog, packageId: string, componentId: string): boolean {
    return ancestry(catalog, componentId).some((component) => component.id === packageId);
  }

  /** Copies an allowlisted public view so callers cannot mutate catalog authority through returned arrays. */
  private project(component: Component, base: string) {
    const value = {
      id: component.id,
      type: component.type,
      parentId: component.parentId,
      purpose: component.purpose,
      objectives: component.objectives ?? [],
      constraints: component.constraints ?? [],
      questions: component.questions ?? [],
      standards: component.standards ?? [],
      owns: component.owns ?? [],
      api: component.api ?? [],
      root: component.root,
      repository: component.repository,
    };
    return { ...structuredClone(value), revision: this.query.revision({ base, component: value }) };
  }
}
