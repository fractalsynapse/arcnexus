import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentV5Fixture } from '../support/component-v5-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises policy reduction against absent defaults, anchored reads and sibling authority. */
class MigrationPolicyScenarios {
  /** Hoists identical scalar defaults while retaining explicit container intent and input bytes. */
  async scalars(): Promise<void> {
    const input = this.tree();
    input.a.role = input.b.role = 'engineer';
    input.a.executionProfile = 'luna';
    const original = structuredClone(input);
    const result = await this.reduce(input);
    assert.equal(result.platform.role, 'engineer');
    assert.equal(result.a.role, undefined);
    assert.equal(result.b.role, undefined);
    assert.equal(result.a.executionProfile, 'luna');
    assert.equal(result.b.executionProfile, undefined);
    assert.deepEqual(input, original);
    assert.deepEqual(await this.reduce(result), result);
  }

  /** Equal relative read strings in different package roots must not become a wider platform grant. */
  async reads(): Promise<void> {
    const input = this.tree();
    input.package.root = 'nested';
    input.platform.reads = ['.'];
    input.a.reads = input.b.reads = ['.'];
    const result = await this.reduce(input);
    assert.deepEqual(result.platform.reads, ['.']);
    assert.deepEqual(result.package.reads, ['.']);
    assert.equal(result.a.reads, undefined);
    assert.equal(result.b.reads, undefined);
  }

  /** Common operation usages move together without making a sibling's agent tools mandatory. */
  async operations(): Promise<void> {
    const input = this.tree();
    input.a.operations = { check: ['verify', 'agent'], private: ['agent'] };
    input.b.operations = { check: ['verify'] };
    const result = await this.reduce(input);
    assert.deepEqual(result.platform.operations, { check: ['verify'] });
    assert.deepEqual(result.a.operations, { check: ['agent'], private: ['agent'] });
    assert.equal(result.b.operations, undefined);
    assert.deepEqual(await this.reduce(result), result);
  }

  /** An explicit parent role is not rewritten to match its children; identity and intent stay local. */
  async intent(): Promise<void> {
    const input = this.tree();
    input.platform.role = 'director';
    input.a.role = input.b.role = 'engineer';
    input.a.objectives = input.b.objectives = ['Keep behavior'];
    input.a.owns = ['a'];
    input.b.owns = ['b'];
    const result = await this.reduce(input);
    assert.equal(result.platform.role, 'director');
    assert.equal(result.package.role, 'engineer');
    assert.deepEqual(result.a.objectives, ['Keep behavior']);
    assert.deepEqual(result.b.owns, ['b']);
  }

  /** Resolves both committed revisions through the production catalog and compares effective authority. */
  async catalog(t: TestContext): Promise<void> {
    const fixture = new ComponentV5Fixture(t);
    const directory = join(fixture.root, 'architecture/components');
    const files = readdirSync(directory);
    const declarations = Object.fromEntries(
      files.map((file) => {
        const value = JSON.parse(readFileSync(join(directory, file), 'utf8'));
        if (['library', 'foundation'].includes(value.type)) {
          value.role = 'engineer';
          value.executionProfile = 'luna';
        }
        fixture.put('architecture/components/' + file, value);
        return [value.id, value];
      }),
    );
    fixture.commit();
    const before = this.authority(fixture);
    const reduced = await this.reduce(declarations);
    for (const file of files) {
      const { id } = JSON.parse(readFileSync(join(directory, file), 'utf8'));
      fixture.put('architecture/components/' + file, reduced[id]);
    }
    fixture.commit();
    assert.deepEqual(this.authority(fixture), before);
  }

  /** Compares permissions and inherited values while excluding intentional provenance and revision changes. */
  private authority(fixture: ComponentV5Fixture): unknown {
    const result = fixture.run('validate');
    assert.equal(result.status, 0, result.stderr);
    return Object.fromEntries(
      Object.entries(JSON.parse(result.stdout).owners).map(([id, value]) => {
        const owner = value as any;
        return [
          id,
          {
            ownedPaths: owner.ownedPaths,
            publicModules: owner.publicModules,
            policy: Object.fromEntries(
              Object.entries(owner.policy).map(([key, entry]) => [key, (entry as any).value]),
            ),
          },
        ];
      }),
    );
  }

  /** Supplies a minimal hierarchy with no implicit execution policy. */
  private tree(): Record<string, any> {
    return {
      platform: { id: 'platform', type: 'platform' },
      package: { id: 'package', type: 'package', parentId: 'platform' },
      a: { id: 'a', type: 'library', parentId: 'package' },
      b: { id: 'b', type: 'library', parentId: 'package' },
    };
  }

  /** Loads the assembled migration stage rather than a source-only implementation. */
  private async reduce(input: Record<string, any>): Promise<Record<string, any>> {
    const path = new URL(
      '../../../../dist/library/architecture/migration-policies.js',
      import.meta.url,
    );
    const { MigrationPolicies } = await import(path.href);
    return new MigrationPolicies(input, 'primary').reduce();
  }
}

const scenarios = new MigrationPolicyScenarios();

test('migration hoists only complete identical scalar defaults', () => scenarios.scalars());

test('migration keeps inherited reads anchored to package roots', () => scenarios.reads());

test('migration preserves distinct operation usages while removing duplication', () =>
  scenarios.operations());

test('migration preserves explicit container policy and local architectural intent', () =>
  scenarios.intent());

test('migration reduction preserves resolved authority in committed catalogs', (t) =>
  scenarios.catalog(t));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
