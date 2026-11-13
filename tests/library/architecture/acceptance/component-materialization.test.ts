import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture } from '../support/component-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Verifies minimal declarations through production catalog loading and ownership validation. */
class ComponentScenarios {
  /** Ignores runtime protection directories without modifying the real source checkout. */
  protectedDirectories(t: TestContext): void {
    const f = new ComponentFixture(t);
    for (const name of ['.agents', '.aws', '.codex', '.git'])
      mkdirSync(join(f.root, 'architecture/components', name));
    const result = f.run('validate');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).components.sort(), [
      'maintenance',
      'maintenance-package',
      'package',
      'platform',
      'sample',
    ]);
  }

  /** Resolves inherited policy, implicit definition ownership and revision-bound file classification. */
  minimal(t: TestContext): void {
    const f = new ComponentFixture(t);
    const r = f.run('validate');
    assert.equal(r.status, 0, r.stderr);
    const owner = JSON.parse(r.stdout).owners.sample;
    assert.equal(owner.repository, 'sample');
    assert.equal(owner.packageRoot, 'package');
    assert.deepEqual(owner.ownedPaths, [
      'package/src',
      'package/docs',
      'package/tests',
      'architecture/components/unrelated-filename.json',
    ]);
    // Write scope is ownership. The view carries no separate grant list that could diverge from it,
    // so the check is that both project the same declared scope rather than that a second list is
    // empty.
    assert.deepEqual(owner.writeScope, owner.ownedPaths);
    assert.equal(
      owner.inventory.find((v: any) => v.path === 'package/docs/value.md').kind,
      'documentation',
    );
    assert.equal(
      owner.inventory.find((v: any) => v.path === 'package/tests/value.test.ts').kind,
      'tests',
    );
    // A component carries no role: the position is named per activity and resolved to its declarer.
    assert.equal(owner.policy['activities.research'].value.role, 'engineer');
    assert.equal(owner.policy['activities.research'].source, 'sample');
    assert.deepEqual(owner.publicModules, ['package/src/value.ts']);
  }

  /** Rejects obsolete authored fields rather than silently deriving around contradictory authority. */
  obsolete(t: TestContext, field: string): void {
    const f = new ComponentFixture(t);
    f.put(
      'architecture/components/unrelated-filename.json',
      f.uncheckedComponent('sample', 'library', {
        parentId: 'package',
        owns: ['src', 'docs', 'tests'],
        [field]: [],
      }),
    );
    f.commit();
    const result = f.run('validate');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /additional|retired|unsupported/i);
  }

  /** Prevents a descendant from widening an explicit read boundary. */
  reads(t: TestContext): void {
    const f = new ComponentFixture(t);
    f.put(
      'architecture/components/package.json',
      f.component('package', 'package', {
        parentId: 'platform',
        root: 'package',
        reads: ['src'],
      }),
    );
    f.put(
      'architecture/components/unrelated-filename.json',
      f.component('sample', 'library', {
        parentId: 'package',
        owns: ['src', 'docs', 'tests'],
        reads: ['.'],
      }),
    );
    f.commit();
    assert.match(f.run('validate').stderr, /read.*widen|widen.*read/i);
  }

  /** Finds both unowned existing files and ownership overlap before future files are created. */
  ownership(t: TestContext, overlap: boolean): void {
    const f = new ComponentFixture(t);
    if (overlap)
      f.put(
        'architecture/components/other.json',
        f.component('other', 'library', {
          parentId: 'package',
          owns: ['src/future'],
        }),
      );
    else f.put('orphan.txt', 'Unowned');
    f.commit();
    assert.match(f.run('validate').stderr, overlap ? /Overlapping ownership/ : /orphan.txt.*owner/);
  }

  /** Captures only committed source and changes its file inventory after a new revision. */
  revision(t: TestContext): void {
    const f = new ComponentFixture(t);
    f.put('package/docs/added.md', 'New document');
    const before = f.run('validate');
    assert.equal(before.status, 0, before.stderr);
    assert.equal(JSON.parse(before.stdout).owners.sample.inventory.length, 4);
    f.commit();
    const after = f.run('validate');
    assert.equal(after.status, 0, after.stderr);
    assert.equal(JSON.parse(after.stdout).owners.sample.inventory.length, 5);
  }
}

const scenarios = new ComponentScenarios();

test('ignores protected directories during catalog discovery', (t) =>
  scenarios.protectedDirectories(t));

test('derives minimal leaf policy, ownership and inventory', (t) => scenarios.minimal(t));

for (const field of ['path', 'discovery', 'verification', 'relatedIds', 'provides', 'operationIds'])
  test(`v5 rejects retired ${field} declarations`, (t) => scenarios.obsolete(t, field));

test('rejects widened inherited read access', (t) => scenarios.reads(t));

test('rejects unowned maintained files', (t) => scenarios.ownership(t, false));

test('rejects overlapping future ownership', (t) => scenarios.ownership(t, true));

test('inventory is pinned to committed authority', (t) => scenarios.revision(t));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
