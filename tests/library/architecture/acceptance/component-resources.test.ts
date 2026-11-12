import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { loadProjectBindings } from '../../../../dist/library/architecture/bindings.js';
import { loadCatalog } from '../../../../dist/library/architecture/components.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { ComponentV5Fixture } from '../support/component-v5-fixture.js';

/** Exercises captured, package-scoped resources through the built public architecture boundary. */
class ComponentResourceScenarios {
  /** Requires valid fixture authority before checking the absent or implemented API. */
  private fixture(t: TestContext) {
    const f = new ComponentV5Fixture(t);
    f.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    f.put(
      'architecture/components/deep.json',
      f.component('deep', 'library', {
        parentId: 'package',
        owns: ['deep'],
      }),
    );
    f.commit();
    const target = { source: f.root, base: f.git('rev-parse', 'HEAD'), packageId: 'package' };
    loadCatalog(target.source, target.base, loadProjectBindings(target.source));
    return { f, target };
  }

  /** Loads the public built module so missing production export fails the behavioral checkpoint. */
  private async service(): Promise<any> {
    const path = '../../../../dist/library/architecture/inspection.js';
    const Service = (await import(path)).ComponentResources;
    assert.equal(typeof Service, 'function', 'ComponentResources public service is missing');
    return new Service();
  }

  /** Includes the package root, pages deterministically and rejects foreign or unknown resources. */
  async scope(t: TestContext): Promise<void> {
    const { f, target } = this.fixture(t);
    const service = await this.service();
    const first = service.list(target, { limit: 2 });
    const second = service.list(target, { limit: 2, cursor: first.nextCursor });
    assert.deepEqual(
      [...first.items, ...second.items].map((x: any) => x.id),
      ['deep', 'package', 'sample'],
    );
    assert.equal(second.nextCursor, null);
    assert.equal(service.get(target, 'package').type, 'package');
    const item = service.get(target, 'sample');
    assert.match(item.revision, /^[a-f0-9]{64}$/);
    assert.deepEqual(item.owns, ['src', 'docs', 'tests']);
    for (const field of [
      'bindings',
      'access',
      'verification',
      'operationPlan',
      'policy',
      'inventory',
    ])
      assert.equal(Object.hasOwn(item, field), false);
    assert.throws(() => service.get(target, 'maintenance'), /outside.*package/i);
    assert.throws(() => service.get(target, 'missing'), /unknown component/i);
    assert.throws(() => service.list({ ...target, packageId: 'sample' }), /package/i);
    assert.equal(f.git('status', '--porcelain'), '');
  }

  /** Uses shared typed AND filters, case-insensitive search, limits and query-bound cursors. */
  async queries(t: TestContext): Promise<void> {
    const { target } = this.fixture(t);
    const service = await this.service();
    const page = service.list(target, { filters: ['type=library', 'id=deep', 'parentId=package'] });
    assert.deepEqual(
      page.items.map((x: any) => x.id),
      ['deep'],
    );
    assert.deepEqual(
      service.list(target, { search: 'SAMPLE' }).items.map((x: any) => x.id),
      ['sample'],
    );
    for (const query of [
      { filters: ['unknown=x'] },
      { filters: ['type=invalid'] },
      { limit: 0 },
      { limit: 101 },
      { cursor: 'invalid' },
    ])
      assert.throws(() => service.list(target, query));
    const first = service.list(target, { limit: 1 });
    assert.throws(
      () => service.list(target, { limit: 1, cursor: first.nextCursor, search: 'sample' }),
      /stale cursor/,
    );
  }

  /** Tokens remain source-bound even when an architectural edit changes no exposed field. */
  async authorityRevision(t: TestContext): Promise<void> {
    const { f, target } = this.fixture(t);
    const service = await this.service();
    const { revision, ...before } = service.get(target, 'sample');
    const path = 'architecture/components/unrelated-filename.json';
    const declaration = JSON.parse(readFileSync(join(f.root, path), 'utf8'));
    declaration.role = 'engineer';
    f.put(path, declaration);
    f.commit();
    const { revision: updated, ...after } = service.get(target, 'sample');
    assert.equal(updated, revision);
    assert.deepEqual(after, before);
    const current = service.get({ ...target, base: f.git('rev-parse', 'HEAD') }, 'sample');
    assert.notEqual(current.revision, revision);
    current.owns.push('forged');
    assert.deepEqual(service.get(target, 'sample').owns, before.owns);
  }

  /** Retained targets keep their source while new committed intent invalidates current resource tokens. */
  async revisions(t: TestContext): Promise<void> {
    const { f, target } = this.fixture(t);
    const service = await this.service();
    const before = service.get(target, 'sample');
    const page = service.list(target, { limit: 1 });
    f.put(
      'architecture/components/unrelated-filename.json',
      f.component('sample', 'library', {
        parentId: 'package',
        owns: ['src', 'docs', 'tests'],
        purpose: 'Updated intent',
        api: [{ module: 'src/value.ts' }],
      }),
    );
    f.commit();
    assert.deepEqual(service.get(target, 'sample'), before);
    const current = { ...target, base: f.git('rev-parse', 'HEAD') };
    assert.equal(service.get(current, 'sample').purpose, 'Updated intent');
    assert.notEqual(service.get(current, 'sample').revision, before.revision);
    assert.throws(
      () => service.list(current, { limit: 1, cursor: page.nextCursor }),
      /stale cursor/,
    );
  }
}

const scenarios = new ComponentResourceScenarios();

test('component resources include the selected package and isolate its descendants', (t) =>
  scenarios.scope(t));

test('component resources apply shared typed queries and cursors', (t) => scenarios.queries(t));

test('component resources preserve captured intent and reject stale revision cursors', (t) =>
  scenarios.revisions(t));

test('component revision tokens retain source authority without exposing policy', (t) =>
  scenarios.authorityRevision(t));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
