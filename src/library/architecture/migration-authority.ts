import { realpathSync } from 'node:fs';
import { digest, resolveBase } from './assignment.js';
import { loadProjectBindings, type Bindings } from './bindings.js';
import { loadCatalog, scopePath, type Catalog } from './components.js';
import { ConfigurationReader } from './configuration.js';
import { InputError } from './config.js';
import { PlatformExecution } from './platform-execution.js';
import { git } from '../operations/process.js';

export interface MigrationAuthority {
  source: string;
  base: string;
  key: string;
  bindings: Bindings;
  catalog: Catalog;
  directorProfile: string;
  reviewerProfile: string;
  verificationInputs: string[];
}

/** Captures read-only migration inputs without constructing an executable host context. */
export function captureMigrationAuthority(cwd: string): MigrationAuthority {
  const { source, base } = resolveBase(cwd);
  const commonDir = realpathSync(
    git(source, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim(),
  );
  const bindings = loadProjectBindings(source);
  const catalog = loadCatalog(source, base, bindings);
  const defaults = Object.values(catalog.components).every((c) => c.schemaVersion === 5)
    ? new PlatformExecution(catalog).defaults(source, base)
    : legacyDefaults(source, base);
  return { source, base, key: digest(commonDir).slice(0, 24), bindings, catalog, ...defaults };
}

/** Preserves legacy authored defaults for conversion only, rejecting unknown or obsolete settings. */
function legacyDefaults(source: string, base: string) {
  const value = new ConfigurationReader().definition(source, base, 'architecture/execution')
    .value as Record<string, unknown>;
  const allowed = ['directorProfile', 'reviewerProfile', 'defaultPackage', 'verificationInputs'];
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      throw new InputError(`Unsupported execution setting: ${key}; remove obsolete work budgets`);
  if (typeof value.directorProfile !== 'string' || typeof value.reviewerProfile !== 'string')
    throw new InputError('Migration requires declared directorProfile and reviewerProfile');
  if (
    value.defaultPackage !== undefined &&
    (typeof value.defaultPackage !== 'string' || !value.defaultPackage.trim())
  )
    throw new InputError('defaultPackage must be a nonempty declared package ID');
  const inputs = value.verificationInputs ?? [];
  if (!Array.isArray(inputs) || inputs.some((path) => typeof path !== 'string' || !path.trim()))
    throw new InputError('verificationInputs must be an array of captured source paths');
  return {
    directorProfile: value.directorProfile,
    reviewerProfile: value.reviewerProfile,
    verificationInputs: inputs.map(scopePath),
  };
}
