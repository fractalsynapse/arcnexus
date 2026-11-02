import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises command extraction using complete captured context rather than command-name guesses. */
class RecipeMigrationScenarios {
  private readonly context = {
    repository: 'primary',
    cwd: '.',
    category: 'cli-check',
    activities: ['research', 'testing'],
    generatedDirectories: ['dist'],
    artifacts: [],
    network: false,
  };

  /** Identical recipes retain a stable reference despite different lifecycle descriptions. */
  async identical(): Promise<void> {
    const extractor = await this.extractor();
    const command = { command: 'node', args: ['--version'] };
    const first = extractor.add(command, this.context, 'Preflight runtime');
    assert.equal(extractor.add(command, this.context, 'Verify runtime'), first);
    assert.equal(extractor.convert().definitions.length, 1);
    const repeated = await this.extractor(extractor.convert().definitions);
    assert.equal(repeated.add(command, this.context, 'New description'), first);
    assert.deepEqual(repeated.convert().definitions, extractor.convert().definitions);
  }

  /** Working context and permissions distinguish otherwise equal commands. */
  async distinctContexts(): Promise<void> {
    const extractor = await this.extractor();
    const command = { command: 'node', args: ['--version'] };
    const base = extractor.add(command, this.context, 'Base');
    for (const difference of [
      { cwd: 'nested' },
      { network: true },
      { generatedDirectories: [] },
      { activities: ['research'] },
      { repository: 'other' },
      { category: 'build' },
    ])
      assert.notEqual(extractor.add(command, { ...this.context, ...difference }, 'Other'), base);
    assert.equal(extractor.convert().definitions.length, 7);
  }

  /** An equivalent authored operation wins deduplication while generated references remain mapped. */
  async authored(): Promise<void> {
    const initial = await this.extractor();
    const command = { command: 'node', args: ['--version'] };
    const generated = initial.add(command, this.context, 'Generated');
    const definition = initial.convert().definitions[0];
    const extractor = await this.extractor([{ ...definition, id: 'authored-runtime' }]);
    extractor.add(command, this.context, 'Lifecycle');
    const result = extractor.convert();
    assert.equal(result.identities[generated], 'authored-runtime');
    assert.equal(result.definitions.length, 1);
  }

  /** Unknown recipe fields and generated-name collisions never silently discard executable policy. */
  async invalid(): Promise<void> {
    const extractor = await this.extractor();
    const command = { command: 'node', args: ['--version'] };
    assert.throws(
      () => extractor.add({ ...command, timeoutSeconds: 1 }, this.context, 'Bad'),
      /recipe/i,
    );
    extractor.add(command, this.context, 'Good');
    const conflicting = extractor
      .convert()
      .definitions.map((entry: any) => ({ ...entry, args: ['--help'] }));
    const collision = await this.extractor(conflicting);
    assert.throws(() => collision.add(command, this.context, 'Collision'), /identity/i);
  }

  /** Loads assembled extraction and deduplication code without launching any migrated commands. */
  private async extractor(definitions: unknown[] = []): Promise<any> {
    const path = new URL(
      '../../../../dist/library/architecture/migration-recipes.js',
      import.meta.url,
    );
    const { MigrationRecipes } = await import(path.href);
    return new MigrationRecipes(definitions);
  }
}

const scenarios = new RecipeMigrationScenarios();

test('inline migration shares identical recipes across lifecycle purposes', () =>
  scenarios.identical());

test('inline migration preserves context and permission differences', () =>
  scenarios.distinctContexts());

test('inline migration links equivalent authored operations', () => scenarios.authored());

test('inline migration rejects unknown fields and generated identity conflicts', () =>
  scenarios.invalid());

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
