import { stringify } from 'yaml';
import { ancestry, loadCatalog } from './components.js';
import { loadProjectBindings } from './bindings.js';
import { ConfigurationReader } from './configuration.js';
import { validateSchema } from './schema.js';
import { InputError } from './config.js';

/** Prepares a minimal authored definition patch without editing source or selecting new authority. */
export class ComponentUpdate {
  /** Resolves the immutable definition and validates fields against its supported authored schema. */
  prepare(
    source: string,
    base: string,
    id: string,
    fields: Record<string, unknown>,
    packageId?: string,
  ) {
    const catalog = loadCatalog(source, base, loadProjectBindings(source));
    const component = catalog.components[id];
    if (!component) throw new InputError('Unknown component: ' + id);
    if (packageId && !ancestry(catalog, id).some((entry) => entry.id === packageId))
      throw new InputError('Component is outside the selected package: ' + id);
    if (component.repository !== catalog.primaryRepository)
      throw new InputError('Update requires the declaring repository');
    const path = catalog.configurationSources.find(
      (entry) =>
        entry.path.startsWith('architecture/components/') &&
        (entry.value as { id?: string }).id === id,
    )?.path;
    if (!path) throw new InputError('Missing component definition: ' + id);
    const original = new ConfigurationReader().revision(source, base, path).value as object;
    const value = { ...original, ...this.fields(fields) };
    try {
      validateSchema('component-v6', value);
    } catch (error) {
      throw new InputError(String(error));
    }
    const text = path.endsWith('.json') ? JSON.stringify(value, null, 2) + '\n' : stringify(value);
    return { path, text };
  }

  /** Rejects malformed application inputs and immutable keys independently of any gateway parser. */
  private fields(fields: Record<string, unknown>): Record<string, unknown> {
    if (
      !fields ||
      typeof fields !== 'object' ||
      Array.isArray(fields) ||
      !Object.keys(fields).length
    )
      throw new InputError('At least one structured field is required');
    if (Object.keys(fields).some((key) => ['id', 'schemaVersion'].includes(key)))
      throw new InputError('Component identity and schema version are immutable; use migration');
    return { ...fields };
  }
}
