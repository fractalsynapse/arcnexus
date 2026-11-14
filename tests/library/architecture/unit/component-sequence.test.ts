import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { ComponentSequence } from '../../../../dist/library/architecture/component-sequence.js';
import { loadCatalog } from '../../../../dist/library/architecture/components.js';

/**
 * Exercises the derived component order.
 *
 * The hand-built catalogs isolate one rule each, with knowledge-root custody made unambiguous so a
 * tie-break never decides a scenario by accident. The shipped scenario loads this repository's real
 * architecture through `loadCatalog`, because a derivation proved only on fixtures can still disagree with
 * the catalog it is meant to order.
 */
class ComponentSequenceScenarios {
  /** Verifies that containers precede everything, and knowledge-root holders precede plain components. */
  lineage(): void {
    const entries = new ComponentSequence(this.catalog(this.tree())).entries();
    assert.deepEqual(
      entries.map((entry) => entry.id),
      ['root', 'pkg', 'writer', 'reader'],
    );
    // Both leaves hold `.arc/` content for others, so both belong to the holder phase: listing only the
    // largest would drop a real holder, and the rule is every holder.
    assert.deepEqual(
      entries.map((entry) => entry.phase),
      ['platform', 'package', 'model-maintainer', 'model-maintainer'],
    );
    assert.deepEqual(entries[1]!.dependsOn, ['root']);
  }

  /** Verifies that holders are ordered by type layer first, then by how much knowledge content they hold. */
  holders(): void {
    const tree = this.tree();
    tree.reader.allowedWritePaths = [
      '.arc/architecture/roles',
      '.arc/architecture/operations',
      '.arc/architecture/components/pkg.yaml',
    ];
    const entries = new ComponentSequence(this.catalog(tree)).entries();
    const holders = entries.filter((entry) => entry.phase === 'model-maintainer');
    assert.deepEqual(
      holders.map((entry) => entry.id),
      ['reader', 'writer'],
      'both holders are listed, most-held first within the same type layer',
    );
    assert.equal(holders[0]!.id, 'reader');
    assert.deepEqual(
      entries.map((entry) => entry.id),
      ['root', 'pkg', 'reader', 'writer'],
    );
  }

  /** Verifies that a holder listed in the knowledge phase never reappears in the type list. */
  noDuplicates(): void {
    const catalog = this.catalog(this.tree());
    const ids = new ComponentSequence(catalog).ids();
    assert.equal(new Set(ids).size, ids.length, 'no component is emitted twice');
    assert.deepEqual(ids, ['root', 'pkg', 'writer', 'reader']);
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
   * Verifies that a relation cycle is refused instead of being broken by the holder preference.
   *
   * Holders are emitted ahead of the type list, so without the dependency guard a mutual relation between
   * two holders would be resolved by fiat and the cycle would disappear from view — the failure this
   * scenario pins.
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

  /** Verifies the phases against the shipped architecture, and that a second call repeats exactly. */
  shippedCatalog(): void {
    const catalog = loadCatalog(process.cwd(), 'HEAD');
    const entries = new ComponentSequence(catalog).entries();
    const ids = entries.map((entry) => entry.id);
    assert.equal(entries[0]!.id, 'arcnexus');
    assert.deepEqual(
      entries.slice(0, 2).map((entry) => entry.id),
      ['arcnexus', 'cli-package'],
    );
    assert.equal(new Set(ids).size, ids.length, 'every component appears exactly once');
    assert.equal(ids.length, Object.keys(catalog.components).length);
    assert.deepEqual(new ComponentSequence(catalog).ids(), ids, 'the derivation is reproducible');

    this.assertShippedHolders(entries);
  }

  /** Asserts the shipped holder phase, the type layer around it, and the absence of duplicates. */
  private assertShippedHolders(entries: any[]): void {
    const holders = entries.filter((entry) => entry.phase === 'model-maintainer');
    assert.deepEqual(
      holders.map((entry) => entry.id),
      ['foundation', 'architecture-maintenance', 'report', 'task-intake'],
      'every knowledge-root holder is listed, not only the largest',
    );
    const components = entries.filter((entry) => entry.phase === 'component');
    assert.equal(components[0]!.id, 'cli', 'the gateway leads the remaining components');
    assert.equal(components.at(-1)!.id, 'release', 'release is last');
    assert.deepEqual(
      components.filter((entry) => holders.some((holder) => holder.id === entry.id)),
      [],
      'holders never reappear in the type list',
    );
  }

  /** Builds a catalog whose knowledge-root custody is unambiguous within each type layer. */
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

test('derived sequence places containers then knowledge holders', () => scenarios.lineage());

test('derived sequence orders holders by type layer then content held', () => scenarios.holders());

test('derived sequence emits every component exactly once', () => scenarios.noDuplicates());

test('derived sequence respects related components', () => scenarios.relations());

test('derived sequence refuses a relation cycle by name', () => scenarios.cycle());

test('derived sequence refuses ambiguous platform authority', () => scenarios.ambiguousAuthority());

test('derived sequence ignores catalog insertion order', () => scenarios.stability());

test('derived sequence matches the shipped architecture and repeats exactly', () =>
  scenarios.shippedCatalog());

registerSuite({ component: 'architecture', level: 'unit', tags: ['deterministic'] });
