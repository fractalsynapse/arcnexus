import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { ConfigurationReader } from '../../../../dist/library/architecture/configuration.js';
import { loadCatalog } from '../../../../dist/library/architecture/components.js';
import {
  resolveAssignment,
  type Assignment,
} from '../../../../dist/library/architecture/assignment.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { workflowFixture } from '../../testing/support/workflow-fixture.js';

/** Exercises regression admission through the built resolver before workspaces or workers exist. */
class AssignmentScopeScenarios {
  /** Rejects an owned but unusable behavioral scope without silently adding test authority. */
  narrowed(t: TestContext): void {
    const { resolve, catalog } = this.fixture(t);
    assert.throws(() => resolve(['source.txt']), /requires owned regression scope beneath tests/);
    assert.deepEqual(catalog.components.sample!.allowedWritePaths, ['source.txt']);
  }

  /** Readable historical profiles cannot remove required tests from newly admitted engineering. */
  legacyProfile(t: TestContext): void {
    const { resolve, catalog } = this.fixture(t);
    const profile = catalog.configurationSources.find((source) =>
      source.path.startsWith('architecture/test-profiles/'),
    )!;
    profile.value = { ...(profile.value as object), schemaVersion: 1 };
    assert.throws(() => resolve(['docs', 'tests']), /Migrate test profile to schemaVersion 2/);
  }

  /** Allows future regression creation without requiring a preexisting suite inventory. */
  valid(t: TestContext): void {
    const { resolve } = this.fixture(t);
    const paths = ['source.txt', 'docs', 'tests/acceptance/new.test.ts'];
    assert.deepEqual(resolve(paths).context.at(-1)!.allowedWritePaths, paths);
  }

  /** Captures all local stewards' full ownership for routing independently of the active write scope. */
  routing(t: TestContext): void {
    const { resolve, catalog } = this.fixture(t);
    const source = catalog.components.sample!;
    catalog.primaryRepository = source.repository;
    source.ownership = { paths: ['docs'], publicModules: [], directoryExceptions: [] };
    catalog.components.recipient = {
      ...source,
      id: 'recipient',
      ownership: { ...source.ownership, paths: ['elsewhere'] },
    };
    catalog.components.remote = {
      ...source,
      id: 'remote',
      repository: 'different',
      definition: undefined,
    };
    const result = resolve(['docs'], 'change', 'documentation');
    assert.deepEqual(Object.hasOwn(result, 'allowedWritePaths'), false);
    const paths = new Map(result.ownership?.map((owner) => [owner.ownerId, owner.paths]));
    assert.deepEqual(paths.get('recipient'), ['elsewhere']);
    assert.equal(paths.has('remote'), false);
    source.ownership.paths.push('later');
    assert.deepEqual(paths.get('sample'), ['docs']);
  }

  /** Test-only characterization cannot be admitted as a behavioral documentation/regression workflow. */
  testOnly(t: TestContext): void {
    const { resolve } = this.fixture(t);
    const paths = ['tests/acceptance/new.test.ts'];
    assert.throws(() => resolve(paths), /requires owned documentation scope/);
    assert.deepEqual(resolve(paths, 'change', 'refactor').context.at(-1)!.allowedWritePaths, paths);
  }

  /** Explicit classification governs hypothetical new documents as it does checked writes. */
  classification(t: TestContext): void {
    const { resolve, catalog } = this.fixture(t);
    catalog.components.sample!.fileClassification = [{ path: 'tests', kind: 'tests' }];
    assert.throws(() => resolve(['tests']), /requires owned documentation scope/);
    assert.deepEqual(resolve(['tests', 'docs/new.md']).context.at(-1)!.allowedWritePaths, [
      'tests',
      'docs/new.md',
    ]);
  }

  /** Package-relative roots cannot be replaced with a similarly named sibling directory. */
  packageRoot(t: TestContext): void {
    const { resolve, catalog } = this.fixture(t);
    const owner = catalog.components.sample!;
    owner.repositoryRoot = 'packages/sample';
    owner.allowedWritePaths = [
      'packages/sample/tests',
      'packages/sample/tests-other',
      'packages/sample/docs',
    ];
    assert.throws(
      () => resolve(['packages/sample/tests-other']),
      /beneath packages\/sample\/tests/,
    );
    const paths = ['packages/sample/tests/unit/new.test.ts', 'packages/sample/docs'];
    assert.deepEqual(resolve(paths).context.at(-1)!.allowedWritePaths, paths);
  }

  /** Custom verification without a Node profile does not acquire Node-specific path requirements. */
  customChecks(t: TestContext): void {
    const { resolve, catalog } = this.fixture(t);
    delete catalog.components.sample!.testProfile;
    assert.deepEqual(resolve(['source.txt', 'docs']).context.at(-1)!.allowedWritePaths, [
      'source.txt',
      'docs',
    ]);
  }

  /** Read-only, prose and characterization workflows do not acquire a new regression-writing mandate. */
  distinct(t: TestContext, kind: Assignment['kind'], changeType?: Assignment['changeType']): void {
    const { resolve } = this.fixture(t);
    assert.doesNotThrow(() => resolve(['source.txt'], kind, changeType));
  }

  /** Supplies the profile declaration as well as its reference in isolated captured authority. */
  private catalog(repository: string, base: string) {
    const catalog = loadCatalog(repository, base);
    Object.assign(catalog.components.sample!, {
      schemaVersion: 6,
      repositoryRoot: '.',
      testProfile: 'node',
      allowedWritePaths: ['source.txt', 'docs', 'tests'],
    });
    catalog.configurationSources.push(
      new ConfigurationReader().parse(
        'architecture/test-profiles/node.json',
        JSON.stringify({ schemaVersion: 2, id: 'node', run: 'check' }),
      ),
    );
    return catalog;
  }

  /** Reuses captured fixture authority and changes only the profile/root fields relevant to admission. */
  private fixture(t: TestContext) {
    const f = workflowFixture(t);
    const base = f.git('rev-parse', 'HEAD');
    const catalog = this.catalog(f.repo, base);
    const resolve = (
      paths: string[],
      kind: Assignment['kind'] = 'change',
      changeType?: Assignment['changeType'],
    ) => {
      catalog.components.sample!.allowedWritePaths = paths;
      return resolveAssignment(f.repo, base, 'sample', {
        capturedCatalog: catalog,
        value: {
          schemaVersion: 3,
          objective: 'Improve the owned behavior',
          kind,
          changeType,
          expectedOutcome: 'Verified behavior',
          acceptanceCriteria: ['Preserve the contract'],
          hostChecks: [],
        },
      });
    };
    return { resolve, catalog };
  }
}

const scenarios = new AssignmentScopeScenarios();

test('behavioral work requires component ownership of a regression location', (t) =>
  scenarios.narrowed(t));

test('behavioral assignment permits new owned regression paths', (t) => scenarios.valid(t));

test('behavioral scope uses the containing package test root', (t) => scenarios.packageRoot(t));

test('custom verification retains its existing path contract', (t) => scenarios.customChecks(t));

for (const kind of ['research', 'review'] as const)
  test(`${kind} assignment needs no writable regression root`, (t) => scenarios.distinct(t, kind));

for (const changeType of ['documentation', 'refactor'] as const)
  test(`${changeType} assignment needs no new behavioral regression`, (t) =>
    scenarios.distinct(t, 'change', changeType));

test('test-only components can characterize existing behavior without a documentation grant', (t) =>
  scenarios.testOnly(t));

test('behavioral documentation admission uses captured classification for new files', (t) =>
  scenarios.classification(t));

test('assignment captures repository-local inbox routing without expanding write authority', (t) =>
  scenarios.routing(t));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });

test('assignment admission rejects a readable legacy test profile', (t) =>
  scenarios.legacyProfile(t));
