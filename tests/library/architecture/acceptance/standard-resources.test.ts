import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { loadCatalog } from '../../../../dist/library/architecture/components.js';
import { loadProjectBindings } from '../../../../dist/library/architecture/bindings.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { ComponentFixture } from '../support/component-fixture.js';

/** Exercises complete committed standard resources through the built public architecture service. */
class StandardResourceScenarios {
  /** Validates ordinary composition before any missing-service assertion can hide invalid setup. */
  private fixture(t: TestContext) {
    const f = new ComponentFixture(t);
    f.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    const path = 'architecture/components/maintenance.json';
    const owner = JSON.parse(readFileSync(join(f.root, path), 'utf8'));
    f.put(path, { ...owner, owns: [...owner.owns, 'architecture/standards'] });
    for (const id of ['alpha', 'beta'])
      f.put(`architecture/standards/${id}.json`, {
        schemaVersion: 1,
        id,
        owner: 'sample',
        purpose: 'Readable code',
        applicability: 'All owned code',
        document: 'docs/value.md',
        examples: [],
        operationIds: [],
      });
    f.commit();
    const target = { source: f.root, base: f.git('rev-parse', 'HEAD'), platformId: 'platform' };
    loadCatalog(target.source, target.base, loadProjectBindings(target.source));
    return { f, target };
  }

  /** Requires the production public export rather than an injected service implementation. */
  private async service(): Promise<any> {
    const path = '../../../../dist/library/architecture/inspection.js';
    const Service = (await import(path)).StandardResources;
    assert.equal(typeof Service, 'function', 'StandardResources public service is missing');
    return new Service();
  }

  /** Lists unused definitions, applies shared queries and preserves source-bound revisions. */
  async reads(t: TestContext): Promise<void> {
    const { f, target } = this.fixture(t);
    const service = await this.service();
    const first = service.list(target, { limit: 1 });
    assert.equal(first.items[0].id, 'alpha');
    assert.equal(service.list(target, { limit: 1, cursor: first.nextCursor }).items[0].id, 'beta');
    assert.equal(
      service.list(target, { filters: ['owner=sample', 'id=beta'], search: 'READABLE' }).items
        .length,
      1,
    );
    const item = service.get(target, 'alpha');
    assert.equal(item.document, 'docs/value.md');
    assert.match(item.revision, /^[a-f0-9]{64}$/);
    f.put('package/docs/value.md', 'Updated guidance');
    f.commit();
    assert.deepEqual(service.get(target, 'alpha'), item);
    const current = { ...target, base: f.git('rev-parse', 'HEAD') };
    assert.notEqual(service.get(current, 'alpha').revision, item.revision);
    assert.throws(
      () => service.list(current, { limit: 1, cursor: first.nextCursor }),
      /stale cursor/,
    );
    assert.equal(f.git('status', '--porcelain'), '');
  }

  /** Rejects invalid identities, queries and ambiguous definitions without granting authority. */
  async rejects(t: TestContext): Promise<void> {
    const { f, target } = this.fixture(t);
    const service = await this.service();
    assert.throws(() => service.get(target, 'absent'), /standard/i);
    assert.throws(() => service.list({ ...target, platformId: 'sample' }), /platform/i);
    assert.throws(() => service.list(target, { filters: ['secret=x'] }));
    assert.throws(() => service.list(target, { limit: 101 }));
    f.put(
      'architecture/standards/alpha.yaml',
      readFileSync(join(f.root, 'architecture/standards/alpha.json'), 'utf8'),
    );
    f.commit();
    assert.throws(
      () => service.list({ ...target, base: f.git('rev-parse', 'HEAD') }),
      /ambiguous/i,
    );
  }

  /** Keeps same-repository platforms separate even when their standard catalog shares a directory. */
  async foreign(t: TestContext): Promise<void> {
    const { f, target } = this.fixture(t);
    const path = 'architecture/components/maintenance.json';
    const owner = JSON.parse(readFileSync(join(f.root, path), 'utf8'));
    f.put(path, { ...owner, owns: [...owner.owns, 'architecture/components/other.json'] });
    f.put('architecture/components/other.json', f.component('other', 'platform'));
    f.commit();
    const service = await this.service();
    const other = { ...target, base: f.git('rev-parse', 'HEAD'), platformId: 'other' };
    assert.deepEqual(service.list(other).items, []);
    assert.throws(() => service.get(other, 'alpha'), /out-of-platform/);
  }

  /** Unused standards still require valid owned documents and declared check references. */
  async invalidReference(t: TestContext): Promise<void> {
    const { f, target } = this.fixture(t);
    const service = await this.service();
    const path = 'architecture/standards/alpha.json';
    const definition = JSON.parse(readFileSync(join(f.root, path), 'utf8'));
    f.put(path, { ...definition, operationIds: ['undeclared'] });
    f.commit();
    const validation = f.run('validate');
    assert.equal(validation.status, 2);
    assert.match(validation.stderr, /Standard check outside owner's operations/);
    assert.throws(
      () => service.list({ ...target, base: f.git('rev-parse', 'HEAD') }),
      /outside owner's operations/,
    );
  }
}

const scenarios = new StandardResourceScenarios();

test('standard resources include unused definitions and retain committed revisions', (t) =>
  scenarios.reads(t));

test('standard resources reject invalid queries and ambiguous definitions', (t) =>
  scenarios.rejects(t));

test('standard resources validate unused check references', (t) => scenarios.invalidReference(t));

test('standard resources isolate same-repository platforms', (t) => scenarios.foreign(t));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
