import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { parse } from 'yaml';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { MigrationFixture } from '../support/migration-fixture.js';
import { ComponentV5Fixture } from '../support/component-v5-fixture.js';

/** Exercises repository-local recipe migration through the assembled maintenance CLI. */
class DependencyMigrationScenarios {
  /** Known dependency ownership permits exact recipe conversion without copying commands into leaves. */
  convert(t: TestContext): void {
    const fixture = this.fixture(t);
    const result = fixture.migrate('--write');
    assert.equal(result.status, 0, result.stderr);
    const directory = join(fixture.root, 'architecture/operations');
    const operations = readdirSync(directory).map((file) =>
      parse(readFileSync(join(directory, file), 'utf8')),
    );
    const setup = operations.find((operation) => operation.args.includes('DEPENDENCY_SETUP'));
    assert.equal(setup.repository, 'dependency');
    assert.equal(setup.cwd, '.');
    assert.deepEqual(setup.generatedDirectories, ['output']);
    const owner = this.read(fixture, 'components/dependency-package.json');
    assert.ok(owner.operations[setup.id].includes('setup'));
    const primary = this.read(fixture, 'components/sample.json');
    assert.equal(primary.operations?.[setup.id], undefined);
    fixture.commit();
    const repeated = fixture.migrate('--write');
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.match(repeated.stdout, /No configuration changes/);
  }

  /** Recipes without a declared accountable owner require a decision before modifying configuration. */
  missingOwner(t: TestContext): void {
    const fixture = this.fixture(t, false);
    const result = fixture.migrate('--write');
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /dependency.*executable owner/i);
    assert.equal(fixture.git('status', '--porcelain'), '');
  }

  /** Captures independent repository identity and machine-local binding without adding source authority. */
  private fixture(t: TestContext, owner = true): MigrationFixture {
    const fixture = new MigrationFixture(t);
    const dependency = new ComponentV5Fixture(t);
    dependency.git('remote', 'add', 'origin', 'https://example.invalid/dependency.git');
    fixture.put('.git/arcnexus/bindings.yaml', {
      schemaVersion: 1,
      repositories: { dependency: dependency.root },
      tools: {},
    });
    const environment = this.read(fixture, 'environment.json');
    environment.schemaVersion = 3;
    environment.prerequisites = [];
    environment.setup = [];
    environment.generatedDirectories = [];
    environment.workspace.dependencies = [
      {
        id: 'dependency',
        repository: 'https://example.invalid/dependency.git',
        path: 'dependencies/dependency',
        commit: dependency.git('rev-parse', 'HEAD'),
        prerequisites: [],
        setup: [{ command: 'node', args: ['-e', 'DEPENDENCY_SETUP'] }],
        generatedDirectories: ['output'],
      },
    ];
    fixture.put('architecture/environment.json', environment);
    if (owner) this.owner(fixture);
    fixture.commit();
    return fixture;
  }

  /** Reuses explicit historical policy while assigning dependency files only to their own repository. */
  private owner(fixture: MigrationFixture): void {
    const container = this.read(fixture, 'components/package.json');
    fixture.put('architecture/components/dependency-package.json', {
      ...container,
      id: 'dependency-package',
      repository: 'dependency',
    });
    const platform = this.read(fixture, 'components/platform.json');
    platform.coverageExclusions = [
      {
        path: 'architecture/components/dependency.json',
        reason: 'Legacy foreign definition; v5 derives its accountable owner',
      },
    ];
    fixture.put('architecture/components/platform.json', platform);
    const leaf = this.read(fixture, 'components/sample.json');
    fixture.put('architecture/components/dependency.json', {
      ...leaf,
      id: 'dependency',
      parentId: 'dependency-package',
      ownership: { ...leaf.ownership, paths: ['.'], publicModules: [] },
    });
    const maintenance = this.read(fixture, 'components/maintenance.json');
    maintenance.ownership.paths.push('architecture/components/dependency-package.json');
    fixture.put('architecture/components/maintenance.json', maintenance);
  }

  /** Reads authored fixture declarations without substituting runtime-derived data. */
  private read(fixture: MigrationFixture, path: string): any {
    return JSON.parse(readFileSync(join(fixture.root, 'architecture', path), 'utf8'));
  }
}

const scenarios = new DependencyMigrationScenarios();

test('config migration preserves known dependency lifecycle repository and outputs', (t) =>
  scenarios.convert(t));

test('config migration rejects dependency recipes without an executable owner', (t) =>
  scenarios.missingOwner(t));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
