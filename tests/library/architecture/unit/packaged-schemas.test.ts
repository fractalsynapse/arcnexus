import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises trusted packaged reference resolution separately from target project schemas. */
class PackagedSchemaScenarios {
  /** Shared definitions expand from registered files into independently mutable snapshots. */
  async shared(t: TestContext): Promise<void> {
    const { loader, root } = await this.fixture(t);
    this.write(root, 'root', { type: 'object', properties: { field: { $ref: './shared.json' } } });
    this.write(root, 'shared', { type: 'string', minLength: 1 });
    const first = loader.read('root');
    assert.deepEqual(first.properties.field, { type: 'string', minLength: 1 });
    first.properties.field.minLength = 0;
    assert.equal(loader.read('root').properties.field.minLength, 1);
  }

  /** Unregistered, remote, cyclic and ambiguous references fail before target contracts can load. */
  async rejected(t: TestContext): Promise<void> {
    const { loader, root } = await this.fixture(t);
    this.write(root, 'shared', { $ref: './root.json' });
    for (const reference of [
      'https://example.invalid/schema.json',
      './unregistered.json',
      './shared.json#/$defs/item',
      './shared.json',
    ]) {
      this.write(root, 'root', { $ref: reference });
      assert.throws(() => loader.read('root'), /Unsupported|Unregistered|cycle/);
    }
    this.write(root, 'root', { $ref: './shared.json', type: 'string' });
    assert.throws(() => loader.read('root'), /Unsupported/);
    assert.throws(() => loader.read('__proto__'), /Unknown runtime schema/);
  }

  /** Copies the actual built loader beside disposable registry inputs without modifying production files. */
  private async fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-packaged-schemas-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const module = join(root, 'loader.mjs');
    copyFileSync(
      new URL('../../../../dist/library/architecture/packaged-schemas.js', import.meta.url),
      module,
    );
    writeFileSync(
      join(root, 'schema-registry.json'),
      JSON.stringify({
        root: './root.json',
        shared: './shared.json',
      }),
    );
    const { PackagedSchemas } = await import(pathToFileURL(module).href);
    return { root, loader: new PackagedSchemas() };
  }

  /** Writes schema fixture content only under the test's private directory. */
  private write(root: string, name: string, value: unknown): void {
    writeFileSync(join(root, name + '.json'), JSON.stringify(value));
  }
}

const scenarios = new PackagedSchemaScenarios();

test('packaged schema references expand shared definitions into independent snapshots', (t) =>
  scenarios.shared(t));

test('packaged schema references reject unauthorized and ambiguous sources', (t) =>
  scenarios.rejected(t));

registerSuite({ component: 'architecture', level: 'unit', tags: ['deterministic'] });
