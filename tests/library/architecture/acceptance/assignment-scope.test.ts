import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
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
    assert.deepEqual(catalog.components.sample!.allowedWritePaths, ['source.txt', 'docs', 'tests']);
  }

  /** Allows future regression creation without requiring a preexisting suite inventory. */
  valid(t: TestContext): void {
    const { resolve } = this.fixture(t);
    const paths = ['source.txt', 'docs', 'tests/acceptance/new.test.ts'];
    assert.deepEqual(resolve(paths).allowedWritePaths, paths);
  }

  /** Package-relative roots cannot be replaced with a similarly named sibling directory. */
  packageRoot(t: TestContext): void {
    const { resolve, catalog } = this.fixture(t);
    const owner = catalog.components.sample!;
    owner.repositoryRoot = 'packages/sample';
    owner.allowedWritePaths = ['packages/sample/tests', 'packages/sample/tests-other'];
    assert.throws(
      () => resolve(['packages/sample/tests-other']),
      /beneath packages\/sample\/tests/,
    );
    const paths = ['packages/sample/tests/unit/new.test.ts'];
    assert.deepEqual(resolve(paths).allowedWritePaths, paths);
  }

  /** Custom verification without a Node profile does not acquire Node-specific path requirements. */
  customChecks(t: TestContext): void {
    const { resolve, catalog } = this.fixture(t);
    delete catalog.components.sample!.testProfile;
    assert.deepEqual(resolve(['source.txt']).allowedWritePaths, ['source.txt']);
  }

  /** Read-only, prose and characterization workflows do not acquire a new regression-writing mandate. */
  distinct(t: TestContext, kind: Assignment['kind'], changeType?: Assignment['changeType']): void {
    const { resolve } = this.fixture(t);
    assert.doesNotThrow(() => resolve(['source.txt'], kind, changeType));
  }

  /** Reuses captured fixture authority and changes only the profile/root fields relevant to admission. */
  private fixture(t: TestContext) {
    const f = workflowFixture(t);
    const base = f.git('rev-parse', 'HEAD');
    const catalog = loadCatalog(f.repo, base);
    Object.assign(catalog.components.sample!, {
      schemaVersion: 6,
      repositoryRoot: '.',
      testProfile: 'node',
      allowedWritePaths: ['source.txt', 'docs', 'tests'],
    });
    const resolve = (
      paths: string[],
      kind: Assignment['kind'] = 'change',
      changeType?: Assignment['changeType'],
    ) =>
      resolveAssignment(f.repo, base, 'sample', {
        capturedCatalog: catalog,
        value: {
          schemaVersion: 3,
          objective: 'Improve the owned behavior',
          kind,
          changeType,
          expectedOutcome: 'Verified behavior',
          acceptanceCriteria: ['Preserve the contract'],
          allowedWritePaths: paths,
          hostChecks: [],
        },
      });
    return { resolve, catalog };
  }
}

const scenarios = new AssignmentScopeScenarios();

test('behavioral assignment rejects narrowing disconnected from the captured test root', (t) =>
  scenarios.narrowed(t));

test('behavioral assignment permits new owned regression paths', (t) => scenarios.valid(t));

test('behavioral scope uses the containing package test root', (t) => scenarios.packageRoot(t));

test('custom verification retains its existing path contract', (t) => scenarios.customChecks(t));

for (const kind of ['research', 'review'] as const)
  test(`${kind} assignment needs no writable regression root`, (t) => scenarios.distinct(t, kind));

for (const changeType of ['documentation', 'refactor'] as const)
  test(`${changeType} assignment needs no new behavioral regression`, (t) =>
    scenarios.distinct(t, 'change', changeType));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
