import type { ModuleRelationship } from './api-imports.js';
import type { Component } from './components.js';

/** Projects architectural intent and discovery without repeating immutable execution inventories. */
export function componentContext(component: Component): unknown {
  if (component.schemaVersion < 5) return component;
  const {
    ownership: _ownership,
    owns: _authoredOwnership,
    inventory: _inventory,
    capturedTests: _tests,
    operationPlan: _plans,
    policy,
    verification,
    observedImports,
    observedConsumers,
    ...intent
  } = component;
  return {
    ...intent,
    policy: policySources(policy),
    verification: verification.map((check) =>
      'id' in check ? { id: check.id, purpose: check.purpose } : check,
    ),
    observedConsumers: importContext(observedConsumers ?? []),
    observedImports: importContext(
      observedImports?.filter((relationship) => relationship.owner !== component.id) ?? [],
    ),
  };
}

/** Retains each policy's declaring component while its effective values stay on the component view. */
function policySources(policy: Component['policy']) {
  return Object.fromEntries(
    Object.entries(policy ?? {}).map(([name, { source }]) => [name, { source }]),
  );
}

/** Shares inherited standard text once across a complete eligible catalog without filtering its owners. */
export function catalogContext(components: Component[]) {
  const standards = new Map<string, NonNullable<Component['standardSnapshots']>[number]>();
  const views = components.map((component) => {
    const { standardSnapshots, ...view } = componentContext(component) as Record<string, unknown>;
    for (const snapshot of (standardSnapshots ?? []) as NonNullable<
      Component['standardSnapshots']
    >) {
      const previous = standards.get(snapshot.id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(snapshot))
        throw new Error('Conflicting captured standard snapshots: ' + snapshot.id);
      standards.set(snapshot.id, snapshot);
    }
    return view;
  });
  return { components: views, standards: [...standards.values()] };
}

/** Groups repeated import observations while preserving each source and every referenced symbol. */
function importContext(relationships: ModuleRelationship[]) {
  const grouped = new Map<string, Omit<ModuleRelationship, 'source'> & { sources: string[] }>();
  for (const { source, symbols, ...relationship } of relationships) {
    const key = JSON.stringify(relationship);
    const entry = grouped.get(key) ?? { ...relationship, symbols: [], sources: [] };
    entry.sources = [...new Set([...entry.sources, source])];
    entry.symbols = [...new Set([...entry.symbols, ...symbols])];
    grouped.set(key, entry);
  }
  return [...grouped.values()];
}
