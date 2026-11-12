import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { ComponentFixture } from '../support/component-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises intentional public boundaries through the built catalog command and captured source. */
class PublicApiScenarios {
  /** Module exports expose actual symbols, signatures and local re-export origins. */
  surface(t: TestContext): void {
    const fixture = this.fixture(t, [{ module: 'src/value.ts' }]);
    fixture.put(
      'package/src/internal.ts',
      'export function parse(value: string): number { return value.length; }\nexport interface Result { value: number }',
    );
    fixture.put(
      'package/src/value.ts',
      "export {parse as decode} from './internal.js';export type {Result} from './internal.js';",
    );
    fixture.commit();
    fixture.put('package/src/internal.ts', 'export const parse = false;');
    const result = fixture.run('validate');
    assert.equal(result.status, 0, result.stderr);
    const surface = JSON.parse(result.stdout).owners.sample.publicApi;
    assert.deepEqual(surface[0].exports.map((symbol: any) => symbol.name).sort(), [
      'Result',
      'decode',
    ]);
    const decode = surface[0].exports.find((symbol: any) => symbol.name === 'decode');
    assert.match(decode.signature, /value: string/);
    assert.equal(decode.declarations[0].path, 'package/src/internal.ts');
  }

  /** A named symbol cannot expose unrelated exports, and links preserve observed schema identity. */
  schema(t: TestContext): void {
    const fixture = this.fixture(t, [
      { module: 'src/value.ts', export: 'value', schema: 'src/value.schema.json' },
    ]);
    fixture.put('package/src/value.schema.json', {
      $id: 'https://example.invalid/value',
      type: 'number',
    });
    fixture.commit();
    const result = fixture.run('validate');
    assert.equal(result.status, 0, result.stderr);
    const surface = JSON.parse(result.stdout).owners.sample.publicApi;
    assert.deepEqual(
      surface[0].exports.map((symbol: any) => symbol.name),
      ['value'],
    );
    assert.equal(surface[0].schema.identity, 'https://example.invalid/value');
    assert.match(surface[0].schema.sha256, /^[a-f0-9]{64}$/);
  }

  /** External re-exports remain visibly unresolved instead of appearing as a known empty surface. */
  unresolved(t: TestContext): void {
    const fixture = this.fixture(t, [{ module: 'src/value.ts' }]);
    fixture.put('package/src/value.ts', "export * from 'unavailable-package';");
    fixture.commit();
    const result = fixture.run('validate');
    assert.equal(result.status, 0, result.stderr);
    const surface = JSON.parse(result.stdout).owners.sample.publicApi;
    assert.match(surface[0].unresolved[0].reason, /unavailable-package/);
  }

  /** Recursive local schema pointers resolve, while missing pointer targets fail explicitly. */
  pointers(t: TestContext): void {
    const fixture = this.fixture(t, [{ schema: 'src/value.schema.json' }]);
    fixture.put('package/src/value.schema.json', {
      $ref: '#/$defs/value',
      $defs: {
        value: {
          type: 'object',
          properties: {
            next: { $ref: '#/$defs/value' },
          },
        },
      },
    });
    fixture.commit();
    const result = fixture.run('validate');
    assert.equal(result.status, 0, result.stderr);
    fixture.put('package/src/value.schema.json', { $ref: '#/$defs/missing', $defs: {} });
    fixture.commit();
    const missing = fixture.run('validate');
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /Missing schema reference target/);
  }

  /** Nonexistent named exports and schema references cannot be advertised as usable contracts. */
  missing(t: TestContext, schema = false): void {
    const fixture = this.fixture(
      t,
      schema
        ? [{ schema: 'src/value.schema.json' }]
        : [{ module: 'src/value.ts', export: 'missing' }],
    );
    if (schema) fixture.put('package/src/value.schema.json', { $ref: './missing.json' });
    fixture.commit();
    const result = fixture.run('validate');
    assert.equal(result.status, 2, result.stdout);
    assert.match(
      result.stderr,
      schema ? /schema reference|tracked regular file/ : /Missing public export/,
    );
  }

  /** Supplies a minimal owned leaf with the scenario's intentional public entry points. */
  private fixture(t: TestContext, api: unknown[]): ComponentFixture {
    const fixture = new ComponentFixture(t);
    fixture.put(
      'architecture/components/unrelated-filename.json',
      fixture.component('sample', 'library', {
        parentId: 'package',
        owns: ['src', 'docs', 'tests'],
        api,
      }),
    );
    return fixture;
  }
}

const scenarios = new PublicApiScenarios();

test('minimal public API derives signatures and local re-export origins', (t) =>
  scenarios.surface(t));

test('minimal named public API retains its schema identity and artifact hash', (t) =>
  scenarios.schema(t));

test('minimal public API rejects a missing named export', (t) => scenarios.missing(t));

test('minimal public API rejects missing local schema references', (t) =>
  scenarios.missing(t, true));

test('public API reports unresolved external exports honestly', (t) => scenarios.unresolved(t));

test('public schemas validate recursive local pointers and reject missing targets', (t) =>
  scenarios.pointers(t));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
