import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises structural migration without allowing unresolved recipes or ownership to disappear. */
class ComponentMigrationScenarios {
  /** Preserves exact ownership, intent and public contracts while omitting redundant wrappers. */
  async leaf(): Promise<void> {
    const input = structuredClone(this.definition);
    const original = structuredClone(input);
    const result = await this.convert(input);
    assert.deepEqual(result.owns, ['src/report', 'tests/report', 'docs/report']);
    assert.deepEqual(result.api, [{ module: 'src/report/report.ts' }]);
    assert.deepEqual(result.operations, { lint: ['agent'], check: ['verify'] });
    assert.deepEqual(result.patterns, ['readable']);
    assert.deepEqual(result.reads, ['.']);
    assert.equal(result.schemaVersion, 5);
    for (const key of ['path', 'access', 'ownership', 'discovery', 'interfaces', 'operationIds'])
      assert.equal(result[key], undefined);
    assert.equal(result.questions, undefined);
    assert.deepEqual(input, original);
    assert.deepEqual(await this.convert(result), result);
  }

  /** Definition ownership uses repository context and rejects broad roots instead of shrinking them. */
  async ownership(): Promise<void> {
    const input = structuredClone(this.definition);
    input.ownership.paths = ['src/report', 'architecture/components'];
    await assert.rejects(() => this.convert(input), /broader.*definition/i);
    input.ownership.paths = ['src/report', '../outside'];
    await assert.rejects(() => this.convert(input), /path/i);
  }

  /** Public schema contracts retain compatibility promises without inventing symbol associations. */
  async contracts(): Promise<void> {
    const input = structuredClone(this.definition);
    input.provides = [
      {
        id: 'receipt',
        version: '1',
        kind: 'json-schema',
        path: 'src/report/receipt.json',
        compatibility: 'Readers preserve version one receipts',
      },
    ];
    const result = await this.convert(input);
    assert.deepEqual(result.api, [
      { module: 'src/report/report.ts' },
      { schema: 'src/report/receipt.json' },
    ]);
    assert.ok(
      result.constraints.includes(
        'receipt (src/report/receipt.json): Readers preserve version one receipts',
      ),
    );
  }

  /** Missing operation references and incomplete inline recipe resolution must prevent conversion. */
  async unresolved(): Promise<void> {
    const input = structuredClone(this.definition);
    await assert.rejects(
      () => this.convert(input, { operationIdentities: {} }),
      /operation.*lint/i,
    );
    await assert.rejects(() => this.convert(input, { verification: [] }), /verification/i);
    input.retiredGuess = true;
    await assert.rejects(() => this.convert(input), /additional properties/i);
  }

  /** Container conversion retains package identity and requires explicit director consolidation. */
  async containers(): Promise<void> {
    const input = structuredClone(this.definition);
    delete input.ownership;
    delete input.discovery;
    input.type = 'package';
    input.repository = 'primary';
    input.repositoryRoot = 'packages/report';
    input.access.writeDirectories = [];
    const result = await this.convert(input);
    assert.equal(result.root, 'packages/report');
    assert.equal(result.repository, 'primary');
    assert.equal(result.owns, undefined);
    input.type = 'platform';
    delete input.parentId;
    delete input.repository;
    delete input.repositoryRoot;
    input.initialization = { schemaVersion: 3, componentId: 'director' };
    await assert.rejects(() => this.convert(input), /director/i);
  }

  /** Supplies complete historical authored syntax rather than a derived runtime component. */
  private readonly definition: any = {
    schemaVersion: 4,
    id: 'report',
    type: 'library',
    parentId: 'package',
    purpose: 'Report evidence',
    path: 'src/report',
    objectives: ['Honest reports'],
    constraints: [],
    questions: [],
    interfaces: [],
    relatedIds: [],
    role: 'engineer',
    executionProfile: 'luna',
    testProfile: 'node',
    access: { readPaths: ['.'], writeDirectories: ['src/report'] },
    verification: [{ command: 'npm', args: ['test'] }],
    operationIds: ['old-lint'],
    patternIds: ['readable'],
    provides: [],
    consumes: [],
    ownership: {
      paths: ['src/report', 'tests/report', 'docs/report', 'architecture/components/renamed.yaml'],
      publicModules: ['src/report/report.ts'],
      directoryExceptions: [],
    },
    discovery: {
      source: ['src/report'],
      documentation: ['docs/report'],
      tests: ['tests/report'],
      exclude: [],
    },
  };

  /** Loads the assembled converter; the coordinator remains responsible for whole-catalog equivalence. */
  private async convert(value: unknown, overrides = {}): Promise<any> {
    const path = new URL(
      '../../../../dist/library/architecture/migration-component.js',
      import.meta.url,
    );
    const { MigrationComponent } = await import(path.href);
    return new MigrationComponent().convert(value, {
      definitionPath: 'architecture/components/renamed.yaml',
      packageRoot: '.',
      operationIdentities: { 'old-lint': 'lint' },
      verification: ['check'],
      ...overrides,
    });
  }
}

const scenarios = new ComponentMigrationScenarios();

test('component migration preserves minimal ownership and execution declarations', () =>
  scenarios.leaf());

test('component migration rejects ownership that cannot become implicit safely', () =>
  scenarios.ownership());

test('component migration preserves schema contracts and compatibility intent', () =>
  scenarios.contracts());

test('component migration rejects unresolved recipes and unknown fields', () =>
  scenarios.unresolved());

test('component migration distinguishes package and platform authority', () =>
  scenarios.containers());

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
