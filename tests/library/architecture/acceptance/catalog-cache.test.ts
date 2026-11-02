import assert from 'node:assert/strict';
import { renameSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import { loadCatalog } from '../../../../dist/library/architecture/components.js';
import { PublicApiCatalog } from '../../../../dist/library/architecture/public-api.js';
import { ComponentV5Fixture } from '../support/component-v5-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises derived-cache reuse and invalidation with real captured repositories. */
class CatalogCacheScenarios {
  /** A captured derived snapshot can be reused without source rereads and without sharing mutable output. */
  reuse(t: TestContext): void {
    const fixture = new ComponentV5Fixture(t);
    const catalog = loadCatalog(fixture.root, fixture.git('rev-parse', 'HEAD'));
    const copy = structuredClone(catalog);
    copy.components.sample!.publicApi![0]!.exports[0]!.name = 'corrupted';
    renameSync(fixture.root, fixture.root + '-retained');
    try {
      new PublicApiCatalog(copy).resolve();
    } finally {
      renameSync(fixture.root + '-retained', fixture.root);
    }
    assert.equal(copy.components.sample!.publicApi![0]!.exports[0]!.name, 'value');
    assert.equal(catalog.components.sample!.publicApi![0]!.exports[0]!.name, 'value');
  }

  /** Changed source or public declarations cannot reuse an incompatible analysis result. */
  invalidation(t: TestContext): void {
    const fixture = new ComponentV5Fixture(t);
    const original = loadCatalog(fixture.root, fixture.git('rev-parse', 'HEAD'));
    fixture.put('package/src/value.ts', 'export const fresh = 3;');
    fixture.commit();
    const updated = loadCatalog(fixture.root, fixture.git('rev-parse', 'HEAD'));
    assert.equal(updated.components.sample!.publicApi![0]!.exports[0]!.name, 'fresh');
    assert.equal(original.components.sample!.publicApi![0]!.exports[0]!.name, 'value');
    updated.components.sample!.api = [{ module: 'package/src/value.ts', export: 'missing' }];
    assert.throws(() => new PublicApiCatalog(updated).resolve(), /Missing public export/);
  }
}

const scenarios = new CatalogCacheScenarios();

test('derived catalog cache returns isolated snapshots without rereading matching source', (t) =>
  scenarios.reuse(t));

test('derived catalog cache invalidates changed source and public declarations', (t) =>
  scenarios.invalidation(t));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
