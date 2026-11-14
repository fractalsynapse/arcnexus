import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { ComponentSequence } from '../../../../dist/library/architecture/component-sequence.js';
import { loadCatalog } from '../../../../dist/library/architecture/components.js';

/**
 * Exercises the derived component order.
 *
 * The hand-built catalogs isolate one rule each, with the model-file dominance made unambiguous so a
 * tie-break never decides a scenario by accident. The shipped scenario loads this repository's real
 * architecture through `loadCatalog`, because a derivation proved only on fixtures can still disagree with
 * the catalog it is meant to order.
 */
class ComponentSequenceScenarios {
  /** Verifies that containers precede the leaves whose defaults they supply, maintainer right after. */
  lineage(): void {
    const entries = new ComponentSequence(this.catalog(this.tree())).entries();
    assert.deepEqual(
      entries.map((entry) => entry.id),
      ['root', 'pkg', 'writer', 'reader'],
    );
    assert.deepEqual(
      entries.map((entry) => entry.phase),
      ['platform', 'package', 'model-maintainer', 'component'],
    );
    assert.deepEqual(entries[1]!.dependsOn, ['root']);
    assert.deepEqual(entries[3]!.dependsOn, ['pkg']);
  }

  /** Verifies that the maintainer is chosen by how much of the model root a component holds. */
  maintainer(): void {
    const tree = this.tree();
    tree.reader.allowedWritePaths = [
      '.arc/architecture/roles',
      '.arc/architecture/operations',
      '.arc/architecture/components/pkg.yaml',
    ];
    const entries = new ComponentSequence(this.catalog(tree)).entries();
    assert.equal(entries[2]!.id, 'reader');
    assert.equal(entries[2]!.phase, 'model-maintainer');
    assert.equal(entries[3]!.id, 'writer');
  }

  /** Verifies that a component is emitted only after the components it relates to. */
  relations(): void {
    const tree = this.tree();
    tree.writer.relatedIds = ['reader'];
    const entries = new ComponentSequence(this.catalog(tree)).entries();
    assert.deepEqual(
      entries.map((entry) => entry.id),
      ['root', 'pkg', 'reader', 'writer'],
    );
    assert.equal(entries[3]!.dependsOn.includes('reader'), true);
  }

  /**
   * Verifies that a relation cycle is refused instead of being broken by the maintainer preference.
   *
   * The maintainer override runs before the topological walk, so without the dependency guard it would emit one
   * half of a cycle first and the cycle would disappear from view — the failure this scenario pins.
   */
  cycle(): void {
    const tree = this.tree();
    tree.writer.relatedIds = ['reader'];
    tree.reader.relatedIds = ['writer'];
    assert.throws(
      () => new ComponentSequence(this.catalog(tree)).entries(),
      /sequence has a cycle among: reader, writer/,
    );
  }

  /** Verifies that two platform documents make authority ambiguous rather than picking one. */
  ambiguousAuthority(): void {
    const tree = this.tree();
    tree.extra = { ...tree.root, id: 'extra' };
    assert.throws(
      () => new ComponentSequence(this.catalog(tree)).entries(),
      /requires exactly one platform; found 2/,
    );
  }

  /** Verifies that insertion order cannot change the result, which is what makes the order callable. */
  stability(): void {
    const tree = this.tree();
    const forward = new ComponentSequence(this.catalog(tree)).ids();
    const shuffled = this.catalog({
      reader: tree.reader,
      pkg: tree.pkg,
      writer: tree.writer,
      root: tree.root,
    });
    assert.deepEqual(new ComponentSequence(shuffled).ids(), forward);
  }

  /** Verifies the derived phases against the shipped architecture, and that a second call repeats. */
  shippedCatalog(): void {
    const catalog = loadCatalog(process.cwd(), 'HEAD');
    const entries = new ComponentSequence(catalog).entries();
    const ids = entries.map((entry) => entry.id);
    assert.equal(entries[0]!.phase, 'platform', 'the platform is always first');
    assert.equal(entries[0]!.id, 'arcnexus');
    assert.deepEqual(
      entries.slice(0, 2).map((entry) => entry.id),
      ['arcnexus', 'cli-package'],
    );
    assert.equal(new Set(ids).size, ids.length, 'every component appears exactly once');
    assert.equal(ids.length, Object.keys(catalog.components).length);
    assert.deepEqual(new ComponentSequence(catalog).ids(), ids, 'the derivation is reproducible');
    const maintainers = entries.filter((entry) => entry.phase === 'model-maintainer');
    assert.equal(maintainers.length, 1, 'exactly one component holds the shared model files');
    assert.equal(maintainers[0]!.id, 'architecture-maintenance');
  }

  /** Builds a catalog whose model-file dominance sits with `writer`, so placement is unambiguous. */
  private tree(): Record<string, any> {
    return {
      root: { id: 'root', type: 'platform', relatedIds: [], allowedWritePaths: [] },
      pkg: {
        id: 'pkg',
        type: 'package',
        parentId: 'root',
        relatedIds: [],
        allowedWritePaths: ['src', 'tests'],
      },
      writer: {
        id: 'writer',
        type: 'library',
        parentId: 'pkg',
        relatedIds: [],
        allowedWritePaths: ['.arc/architecture/roles', '.arc/architecture/environment.yaml'],
      },
      reader: {
        id: 'reader',
        type: 'library',
        parentId: 'pkg',
        relatedIds: [],
        allowedWritePaths: ['.arc/architecture/operations'],
      },
    };
  }

  /** Wraps component records in the catalog shape the sequence consumes. */
  private catalog(components: Record<string, any>): any {
    return { components };
  }
}

const scenarios = new ComponentSequenceScenarios();

test('derived sequence places containers before their leaves', () => scenarios.lineage());

test('derived sequence places the model maintainer before model readers', () =>
  scenarios.maintainer());

test('derived sequence respects related components', () => scenarios.relations());

test('derived sequence refuses a relation cycle by name', () => scenarios.cycle());

test('derived sequence refuses ambiguous platform authority', () => scenarios.ambiguousAuthority());

test('derived sequence ignores catalog insertion order', () => scenarios.stability());

test('derived sequence matches the shipped architecture and repeats exactly', () =>
  scenarios.shippedCatalog());

registerSuite({ component: 'architecture', level: 'unit', tags: ['deterministic'] });
