import { stringify } from 'yaml';
import { ancestry, loadCatalog } from './components.js';
import { loadProjectBindings } from './bindings.js';
import { ConfigurationReader } from './configuration.js';
import { StandardResources, type StandardResourceTarget } from './standard-resources.js';
import { validateSchema } from './schema.js';
import { InputError } from './config.js';

/** Prepares standard definition mutations while preserving stable identity and platform scope. */
export class StandardUpdate {
  /** Validates authored inputs without changing the selected composition or touching source files. */
  prepare(
    target: StandardResourceTarget,
    id: string,
    fields: Record<string, unknown>,
    action: 'create' | 'update' | 'remove',
  ) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id)) throw new InputError('Invalid standard identity');
    const existing = new StandardResources().list(target, { filters: ['id=' + id] }).items[0];
    if (action === 'create' && existing) throw new InputError('Standard already exists: ' + id);
    if (action !== 'create') new StandardResources().get(target, id);
    const original =
      action === 'create'
        ? undefined
        : new ConfigurationReader().definition(
            target.source,
            target.base,
            `architecture/standards/${id}`,
          );
    const path = original?.path ?? `architecture/standards/${id}.yaml`;
    if (action === 'remove') return { path, text: null };
    const value = {
      ...(original?.value ?? { schemaVersion: 1, id, examples: [], operationIds: [] }),
      ...this.fields(fields),
    };
    this.validate(target, value);
    const text = path.endsWith('.json') ? JSON.stringify(value, null, 2) + '\n' : stringify(value);
    return { path, text, ...(action === 'create' ? { create: true } : {}) };
  }

  /** Checks schema and accountable owner against the selected committed platform before creating a proposal. */
  private validate(target: StandardResourceTarget, value: any): void {
    try {
      validateSchema('standard', value);
      const catalog = loadCatalog(target.source, target.base, loadProjectBindings(target.source));
      const owner = catalog.components[value.owner];
      if (
        !owner ||
        ['platform', 'package'].includes(owner.type) ||
        !ancestry(catalog, owner.id).some((entry) => entry.id === target.platformId)
      )
        throw new Error('Standard owner is outside the selected platform or is not executable');
      if (owner.repository !== catalog.primaryRepository)
        throw new Error('Standard mutation requires the declaring repository');
    } catch (error) {
      throw new InputError(String(error));
    }
  }

  /** Rejects immutable keys and empty application mutations independently of CLI parsing. */
  private fields(fields: Record<string, unknown>): Record<string, unknown> {
    if (
      !fields ||
      typeof fields !== 'object' ||
      Array.isArray(fields) ||
      !Object.keys(fields).length
    )
      throw new InputError('At least one structured field is required');
    if (Object.keys(fields).some((key) => ['id', 'schemaVersion'].includes(key)))
      throw new InputError('Standard identity and schema version are immutable; use migration');
    return { ...fields };
  }
}
