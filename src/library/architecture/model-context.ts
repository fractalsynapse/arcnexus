import type { ModuleRelationship } from './api-imports.js';
import type { Component } from './components.js';

/** Projects architectural intent and discovery without repeating immutable execution inventories. */
export function componentContext(component: Component): unknown {
  if (component.schemaVersion !== 5) return component;
  const {
    inventory: _inventory,
    capturedTests: _tests,
    operationPlan: _plans,
    policy,
    verification,
    observedImports,
    ...intent
  } = component;
  return {
    ...intent,
    policy: Object.fromEntries(
      Object.entries(policy ?? {}).map(([name, declaration]) => [
        name,
        { source: declaration.source },
      ]),
    ),
    verification: verification.map((check) =>
      'id' in check ? { id: check.id, purpose: check.purpose } : check,
    ),
    observedImports: importContext(
      observedImports?.filter((relationship) => relationship.owner !== component.id) ?? [],
    ),
  };
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
