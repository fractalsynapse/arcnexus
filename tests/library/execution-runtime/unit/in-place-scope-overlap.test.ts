import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  inPlaceIntersections,
  overlaps,
  porcelainPaths,
} from '../../../../dist/library/execution-runtime/run-creation.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/**
 * Guards the in-place fan-out admission rule.
 *
 * Sequential activations share one checkout, so two components may run together only when their
 * declared ownership scopes cannot write the same file. This is the whole safety property of the
 * fan-out guard, so it is tested directly rather than only through a live run.
 */
class ScopeOverlapScenarios {
  /** Equal and nested scopes overlap in both nesting directions. */
  nesting(): void {
    assert.equal(overlaps('src/app', 'src/app'), true, 'identical scopes');
    assert.equal(overlaps('src/app/module', 'src/app'), true, 'descendant over ancestor');
    assert.equal(overlaps('src/app', 'src/app/module'), true, 'ancestor over descendant');
    assert.equal(overlaps('src', 'src/app/module'), true, 'two levels apart');
  }

  /** Sibling scopes and name prefixes share no files, so they must not collide. */
  disjoint(): void {
    assert.equal(overlaps('src/app', 'src/lib'), false, 'siblings');
    assert.equal(overlaps('docs', 'docs-archive'), false, 'name prefix is not a path prefix');
    assert.equal(overlaps('src/app', 'src/application'), false, 'longer sibling by name');
    assert.equal(overlaps('tests/unit', 'tests/regression'), false, 'test roots apart');
  }

  /** A whole-repository scope overlaps everything, however it is spelled. */
  wholeRepository(): void {
    assert.equal(overlaps('.', 'src/app'), true, 'dot covers a scope');
    assert.equal(overlaps('src/app', '.'), true, 'covered by the dot form');
    assert.equal(overlaps('./', '.arc/architecture/roles'), true, 'dot-slash form');
    assert.equal(overlaps('.', '.'), true, 'two whole-repository scopes');
  }

  /**
   * Admission considers every owned scope, not only source and test trees.
   *
   * A component maintaining documentation or root guidance owns those paths exactly as a library
   * owns `src/`, so uncommitted work there must block an in-place run over the same checkout.
   */
  admissionCoversEveryScope(): void {
    assert.deepEqual(
      inPlaceIntersections(['docs/architecture.md'], ['docs']),
      ['docs/architecture.md'],
      'documentation scope counts',
    );
    assert.deepEqual(
      inPlaceIntersections(['AGENTS.md'], ['AGENTS.md']),
      ['AGENTS.md'],
      'a single owned file counts',
    );
    assert.deepEqual(
      inPlaceIntersections(['src/application/boot.ts'], ['src/app']),
      [],
      'name prefix is not scope',
    );
    assert.deepEqual(
      inPlaceIntersections(['src/app/boot.ts', 'docs/spec.md'], ['src/app']),
      ['src/app/boot.ts'],
      'only paths inside the scope block',
    );
  }

  /** Renames and copies contribute both ends; quoted paths decode to filesystem paths. */
  statusParsing(): void {
    assert.deepEqual(
      porcelainPaths('R  src/old.ts -> src/new.ts\n?? untracked.txt\n D  deleted.txt'),
      ['src/old.ts', 'src/new.ts', 'untracked.txt', 'deleted.txt'],
    );
    assert.deepEqual(porcelainPaths('M  "with space.md"'), ['with space.md']);
    assert.deepEqual(porcelainPaths(''), []);
  }

  /** Trailing and leading spellings of one directory mean the same scope. */
  spelling(): void {
    assert.equal(overlaps('src/app/', 'src/app'), true, 'trailing slash');
    assert.equal(overlaps('./src/app', 'src/app'), true, 'leading dot-slash');
    assert.equal(overlaps('./src/app/', './src/app'), true, 'both spellings at once');
  }
}

const scenarios = new ScopeOverlapScenarios();

test('in-place scope overlap covers equal and nested ownership scopes', () => scenarios.nesting());

test('in-place scope overlap spares sibling scopes and name prefixes', () => scenarios.disjoint());

test('a whole-repository ownership scope overlaps every other scope', () =>
  scenarios.wholeRepository());

test('scope spelling does not change whether two scopes overlap', () => scenarios.spelling());

test('in-place admission weighs every owned scope, not only source trees', () =>
  scenarios.admissionCoversEveryScope());

test('uncommitted paths are read from porcelain records including renames', () =>
  scenarios.statusParsing());

registerSuite({ component: 'execution-runtime', level: 'unit', tags: ['deterministic'] });
