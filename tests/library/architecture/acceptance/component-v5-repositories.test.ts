import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ComponentV5Fixture } from '../support/component-v5-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises implicit definition ownership without confusing two repository-relative namespaces. */
class RepositoryOwnershipScenarios {
  /** Keeps definition accountability in the catalog while dependency writes remain repository-local. */
  definition(t: TestContext): void {
    const { fixture, bindings } = this.fixture(t);
    const result = fixture.run('validate', '--bindings', bindings);
    assert.equal(result.status, 0, result.stderr);
    const owner = JSON.parse(result.stdout).owners.other;
    assert.deepEqual(owner.ownedPaths, ['package']);
    assert.deepEqual(owner.writeScope, ['package']);
    assert.equal(owner.definition.repository, 'sample');
    assert.equal(owner.definition.path, 'architecture/components/other.json');
    assert.match(owner.definition.sourceHash, /^[a-f0-9]{64}$/);
    assert.ok(owner.inventory.every((file: any) => file.path.startsWith('package/')));
  }

  /** Rejects maintained files omitted from a bound repository's ownership declarations. */
  unowned(t: TestContext): void {
    const { fixture, dependency, bindings } = this.fixture(t);
    dependency.put('unowned.txt', 'Maintain this file');
    dependency.commit();
    this.bind(fixture, dependency, bindings);
    const result = fixture.run('validate', '--bindings', bindings);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /unowned.txt requires exactly one owner/);
  }

  /** Rejects competing implementation roots in a bound repository before reporting a valid catalog. */
  overlap(t: TestContext): void {
    const { fixture, bindings } = this.fixture(t);
    const path = 'architecture/components/other-maintenance.json';
    const owner = JSON.parse(readFileSync(join(fixture.root, path), 'utf8'));
    owner.owns.push('package');
    fixture.put(path, owner);
    fixture.commit();
    const result = fixture.run('validate', '--bindings', bindings);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Overlapping ownership.*other/);
  }

  /** Keeps an unbound repository visible without inventing a source inventory. */
  unbound(t: TestContext): void {
    const { fixture } = this.fixture(t);
    const result = fixture.run('validate');
    assert.equal(result.status, 0, result.stderr);
    const owner = JSON.parse(result.stdout).owners.other;
    assert.equal(owner.inventoryAvailability, 'requires_repository_binding');
    assert.deepEqual(owner.inventory, []);
    assert.equal(owner.definition.repository, 'sample');
  }

  /** Captures two independent repositories and a single primary-authored dependency owner. */
  private fixture(t: TestContext) {
    const fixture = new ComponentV5Fixture(t),
      dependency = new ComponentV5Fixture(t);
    fixture.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    dependency.git('remote', 'add', 'origin', 'https://example.invalid/other.git');
    this.owners(fixture);
    const bindings = fixture.root + '-bindings.json';
    t.after(() => rmSync(bindings, { force: true }));
    this.bind(fixture, dependency, bindings);
    return { fixture, dependency, bindings };
  }

  /** Declares dependency implementation and primary container-file maintenance without duplicate leaf paths. */
  private owners(fixture: ComponentV5Fixture): void {
    fixture.put(
      'architecture/components/other-package.json',
      fixture.component('other-package', 'package', {
        parentId: 'platform',
        repository: 'other',
      }),
    );
    fixture.put(
      'architecture/components/other.json',
      fixture.component('other', 'library', {
        parentId: 'other-package',
        owns: ['package'],
      }),
    );
    fixture.put(
      'architecture/components/other-maintenance.json',
      fixture.component('other-maintenance', 'foundation', {
        parentId: 'other-package',
        owns: ['architecture'],
      }),
    );
    const path = 'architecture/components/maintenance.json';
    const owner = JSON.parse(readFileSync(join(fixture.root, path), 'utf8'));
    owner.owns.push('architecture/components/other-package.json');
    fixture.put(path, owner);
  }

  /** Refreshes only the declared dependency revision; the binding stays outside captured source. */
  private bind(
    fixture: ComponentV5Fixture,
    dependency: ComponentV5Fixture,
    bindings: string,
  ): void {
    fixture.put('architecture/environment.json', {
      schemaVersion: 4,
      workspace: {
        primary: { id: 'sample', repository: 'https://example.invalid/sample.git' },
        dependencies: [
          {
            id: 'other',
            repository: 'https://example.invalid/other.git',
            path: 'dependencies/other',
            commit: dependency.git('rev-parse', 'HEAD'),
          },
        ],
      },
    });
    writeFileSync(
      bindings,
      JSON.stringify({ schemaVersion: 1, repositories: { other: dependency.root }, tools: {} }),
    );
    fixture.commit();
  }
}

const scenarios = new RepositoryOwnershipScenarios();

test('bound component definition ownership retains its actual repository', (t) =>
  scenarios.definition(t));

test('minimal catalog validates maintained ownership in bound repositories', (t) =>
  scenarios.unowned(t));

test('minimal catalog rejects overlapping ownership in bound repositories', (t) =>
  scenarios.overlap(t));

test('unbound minimal dependency inventories remain explicitly unavailable', (t) =>
  scenarios.unbound(t));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
