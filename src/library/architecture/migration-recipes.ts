import { commands, type Command } from './config.js';
import { ConfigurationReader } from './configuration.js';
import { MigrationOperations } from './migration-operations.js';
import { validateSchema } from './schema.js';

interface RecipeContext {
  repository: string;
  cwd: string;
  category: string;
  activities: string[];
  generatedDirectories: string[];
  artifacts: string[];
  network?: boolean;
}

interface Recipe extends RecipeContext, Command {
  schemaVersion: 4;
  id: string;
  purpose: string;
  kind: 'command';
  prerequisites: string[];
}

/** Extracts inline commands into stable shared definitions without inferring execution privileges. */
export class MigrationRecipes {
  private readonly definitions: Map<string, unknown>;

  /** Clones existing definitions and validates their schema before adding lifecycle references. */
  constructor(definitions: unknown[]) {
    new MigrationOperations(definitions);
    this.definitions = new Map(
      definitions.map((value) => [(value as { id: string }).id, structuredClone(value)]),
    );
  }

  /** Returns a stable reference while refusing unknown recipe fields or conflicting authored identities. */
  add(value: unknown, context: RecipeContext, purpose: string): string {
    if (
      !value ||
      typeof value !== 'object' ||
      Object.keys(value).some((key) => !['command', 'args'].includes(key))
    )
      throw new Error('Unsupported inline recipe fields; resolve executable policy explicitly');
    const command = commands([value])[0]!;
    const entry: Recipe = {
      ...structuredClone(context),
      schemaVersion: 4,
      id: 'pending',
      purpose,
      kind: 'command',
      prerequisites: [],
      ...command,
    };
    entry.activities.sort();
    entry.generatedDirectories.sort();
    entry.artifacts.sort();
    if (entry.network === false) delete entry.network;
    validateSchema('operation-v4', entry);
    entry.id = 'migrated-recipe-' + this.semantics(entry).slice(0, 16);
    const existing = this.definitions.get(entry.id) as Recipe | undefined;
    if (existing && this.semantics(existing) !== this.semantics(entry))
      throw new Error('Generated recipe identity conflicts with authored operation: ' + entry.id);
    if (!existing) this.definitions.set(entry.id, entry);
    return entry.id;
  }

  /** Deduplicates against authored operations only after collecting all dependency references. */
  convert(): ReturnType<MigrationOperations['convert']> {
    return new MigrationOperations([...this.definitions.values()]).convert();
  }

  /** Uses the configuration parser's canonical digest so object-key order never changes a reference. */
  private semantics(entry: Recipe): string {
    const { id: _id, purpose: _purpose, ...execution } = entry;
    return new ConfigurationReader().parse('recipe.json', JSON.stringify(execution)).normalizedHash;
  }
}
