import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { ComponentFixture } from '../support/component-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Checks symbol-level owner boundaries and generated consumer evidence through production catalog loading. */
class PublicImportScenarios {
  /** A public file does not grant access to symbols omitted by its named API declaration. */
  rejected(t: TestContext, source: string): void {
    const fixture = this.fixture(t, source);
    const result = fixture.run('validate');
    assert.equal(result.status, 2, result.stdout);
    assert.match(result.stderr, /Private cross-owner symbol/);
  }

  /** Static namespace usage produces the same observed consumer relationship as a named import. */
  allowed(t: TestContext, alias = false): void {
    const path = alias ? '@value' : '../src/value.js';
    const fixture = this.fixture(
      t,
      `import * as api from '${path}'; export const result = api.value;`,
    );
    if (alias) {
      fixture.put('package/tsconfig.json', {
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@value': ['src/value.ts'],
          },
        },
      });
      fixture.commit();
    }
    const result = fixture.run('validate');
    assert.equal(result.status, 0, result.stderr);
    const owners = JSON.parse(result.stdout).owners;
    const consumer = owners.sample.consumers.find((entry: any) => entry.owner === 'consumer');
    assert.deepEqual(consumer.symbols, ['value']);
    assert.equal(consumer.source, 'package/consumer/index.ts');
    assert.equal(owners.consumer.imports[0].owner, 'sample');
  }

  /** JavaScript destructuring, direct properties and type-only references retain the actually selected symbols. */
  form(t: TestContext, source: string, typeOnly = false): void {
    const fixture = this.fixture(t, source);
    const result = fixture.run('validate');
    assert.equal(result.status, 0, result.stderr);
    const relationship = JSON.parse(result.stdout).owners.consumer.imports[0];
    assert.deepEqual(relationship.symbols, ['value']);
    assert.equal(relationship.typeOnly, typeOnly);
  }

  /** Generated module paths map to captured source using authored compiler output declarations. */
  generated(t: TestContext): void {
    const fixture = this.fixture(
      t,
      "import {value} from '../generated/value.js';export const result=value;",
    );
    fixture.put('package/tsconfig.json', {
      compilerOptions: { rootDir: 'src', outDir: 'generated' },
    });
    fixture.commit();
    const result = fixture.run('validate');
    assert.equal(result.status, 0, result.stderr);
    const relationship = JSON.parse(result.stdout).owners.consumer.imports[0];
    assert.equal(relationship.target, 'package/src/value.ts');
  }

  /** Compiler aliases cannot hide runtime import cycles from architectural validation. */
  cycle(t: TestContext): void {
    const fixture = this.fixture(t, "import {value} from '@value';export const result=value;");
    fixture.put(
      '.arc/architecture/components/consumer.json',
      fixture.component('consumer', 'library', {
        parentId: 'package',
        owns: ['consumer'],
        api: [{ module: 'consumer/index.ts' }],
      }),
    );
    fixture.put(
      'package/src/value.ts',
      "import {result} from '@consumer';export const value=result;",
    );
    fixture.put('package/tsconfig.json', {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@value': ['src/value.ts'],
          '@consumer': ['consumer/index.ts'],
        },
      },
    });
    fixture.commit();
    const result = fixture.run('validate');
    assert.equal(result.status, 2, result.stdout);
    assert.match(result.stderr, /Runtime import cycle/);
  }

  /** Creates two disjoint owners with one intentionally exposed value and one private export. */
  private fixture(t: TestContext, source: string): ComponentFixture {
    const fixture = new ComponentFixture(t);
    fixture.put(
      '.arc/architecture/components/unrelated-filename.json',
      fixture.component('sample', 'library', {
        parentId: 'package',
        owns: ['src', 'docs', 'tests', 'tsconfig.json'],
        api: [{ module: 'src/value.ts', export: 'value' }],
      }),
    );
    fixture.put(
      '.arc/architecture/components/consumer.json',
      fixture.component('consumer', 'library', {
        parentId: 'package',
        owns: ['consumer'],
      }),
    );
    fixture.put('package/src/value.ts', 'export const value = 1; export const hidden = 2;');
    fixture.put('package/consumer/index.ts', source);
    fixture.commit();
    return fixture;
  }
}

const scenarios = new PublicImportScenarios();

test('named API rejects imports of private symbols from an otherwise public module', (t) =>
  scenarios.rejected(t, "import {hidden} from '../src/value.js';export const result=hidden;"));

test('named API rejects private namespace properties', (t) =>
  scenarios.rejected(t, "import * as api from '../src/value.js';export const result=api.hidden;"));

test('escaping namespaces cannot bypass named API boundaries', (t) =>
  scenarios.rejected(t, "import * as api from '../src/value.js';export {api};"));

test('public namespace usage derives actual consumers without authored relationships', (t) =>
  scenarios.allowed(t));

test('captured compiler aliases resolve public consumer relationships', (t) =>
  scenarios.allowed(t, true));

test('public CommonJS property access derives the used symbol', (t) =>
  scenarios.form(t, "export const result = require('../src/value.js').value;"));

test('public CommonJS destructuring derives the selected symbol', (t) =>
  scenarios.form(t, "const {value}=require('../src/value.js');export {value};"));

test('public type-only imports remain type-only relationships', (t) =>
  scenarios.form(
    t,
    "import type {value} from '../src/value.js';export type Value=typeof value;",
    true,
  ));

test('captured compiler output maps generated imports to owned source', (t) =>
  scenarios.generated(t));

test('compiler aliases cannot hide runtime import cycles', (t) => scenarios.cycle(t));

test('type import queries cannot bypass named API boundaries', (t) =>
  scenarios.rejected(t, "export type Hidden = typeof import('../src/value.js').hidden;"));

test('TypeScript require aliases cannot bypass named API boundaries', (t) =>
  scenarios.rejected(t, "import api = require('../src/value.js');export const result=api.hidden;"));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
