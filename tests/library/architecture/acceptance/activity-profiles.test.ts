import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { ComponentFixture, selectedActivities } from '../support/component-fixture.js';
import { resolveAssignment } from '../../../../dist/library/architecture/assignment.js';
import { loadCatalog } from '../../../../dist/library/architecture/components.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/**
 * Proves that a component holds exactly the activities it declares.
 *
 * A component used to be able to name models in a separate `activityProfiles` map and to inherit
 * activities it never declared. Both are gone: each activity states its position, model, bound
 * operations and own direction, and an ancestor naming an activity does not hand it to a descendant.
 * These scenarios drive the built CLI and the real captured assignment, so the rule is checked where
 * authority is actually resolved rather than against a helper.
 */
class ActivityProfileScenarios {
  /** The leaf's own declaration resolves as its own, and an ancestor-only activity is not held. */
  ownDeclaration(t: TestContext): void {
    const f = this.fixture(t);
    f.put(
      '.arc/architecture/components/platform.json',
      f.component('platform', 'platform', {
        executionProfile: 'luna',
        reads: ['.'],
        activities: {
          ...selectedActivities('sol'),
          release: this.activity('engineer', 'sol', 'Publish only the verified line'),
        },
      }),
    );
    f.put(
      '.arc/architecture/components/unrelated-filename.json',
      this.leaf(f, selectedActivities('luna')),
    );
    f.commit();
    assert.equal(f.run('validate').status, 0, f.run('validate').stderr);
    const leaf = loadCatalog(f.root, f.git('rev-parse', 'HEAD')).components.sample!;
    assert.deepEqual(Object.keys(leaf.activities!).sort(), ['research', 'review', 'testing']);
    const research = leaf.activities!.research!;
    assert.equal(research.profile, 'luna');
    assert.deepEqual(leaf.policy!['activities.research'], { value: research, source: 'sample' });
  }

  /** Assignments retain the profile contents they captured; a caller selection overrides them all. */
  capture(t: TestContext): void {
    const f = this.fixture(t);
    this.execution(f);
    // The leaf states its own model per activity and owns the operation it runs, so its
    // verification is derived rather than inherited from the package above it.
    f.put(
      '.arc/architecture/components/unrelated-filename.json',
      this.leaf(
        f,
        {
          ...selectedActivities('luna'),
          research: this.activity('engineer', 'sol', 'Establish what the owned code guarantees'),
        },
        { check: ['verify'] },
      ),
    );
    f.commit();
    const base = f.git('rev-parse', 'HEAD');
    const options = { objective: 'Research current behavior', kind: 'research' };
    const captured = resolveAssignment(f.root, base, 'sample', options);
    assert.equal(captured.executionProfile.id, 'luna');
    assert.equal(captured.activities.research!.profile!.model, 'test-sol');
    assert.equal(captured.activities.testing!.profile!.id, 'luna');
    this.callerSelectionOverridesAll(f, base, options);
    this.remainsRevisionBound(f, captured);
  }

  /** An explicit caller profile replaces activity routing everywhere, not just the default. */
  private callerSelectionOverridesAll(
    f: ComponentFixture,
    base: string,
    options: Record<string, unknown>,
  ): void {
    const director = resolveAssignment(f.root, base, 'sample', {
      ...options,
      executionProfile: 'sol',
    });
    assert.equal(director.activities.research!.profile!.id, 'sol');
    assert.equal(director.activities.testing!.profile!.id, 'sol');
  }

  /** A later edit to a profile cannot change what an authorized assignment was already told. */
  private remainsRevisionBound(
    f: ComponentFixture,
    captured: { activities: Record<string, any> },
  ): void {
    f.put('.arc/architecture/execution-profiles/sol.json', this.profile('new-model'));
    f.commit();
    assert.equal(captured.activities.research.profile.model, 'test-sol');
  }

  /** An activity's model cannot bypass the operation categories that profile permits. */
  operationAuthority(t: TestContext): void {
    const f = this.fixture(t);
    this.execution(f);
    // The operation is bound by the activity itself, so the model that activity names is the one
    // whose permitted categories are checked.
    f.put(
      '.arc/architecture/components/unrelated-filename.json',
      this.leaf(
        f,
        {
          ...selectedActivities('sol'),
          testing: {
            ...this.activity('engineer', 'sol', 'Prove the change against the contract'),
            operations: ['check'],
          },
        },
        { check: ['verify'] },
      ),
    );
    f.put('.arc/architecture/execution-profiles/sol.json', {
      ...this.profile('test-sol'),
      operationCategories: [],
    });
    f.commit();
    assert.match(f.run('validate').stderr, /Operation category not permitted/);
  }

  /** Unknown profile references and misspelled activity names fail before execution. */
  invalid(t: TestContext, activity: string, profile: string): void {
    const f = this.fixture(t);
    f.put(
      '.arc/architecture/components/package.json',
      f.uncheckedComponent('package', 'package', {
        parentId: 'platform',
        root: 'package',
        activities: {
          [activity]: this.activity('engineer', profile, 'Name the decision at stake'),
        },
      }),
    );
    f.commit();
    assert.equal(f.run('validate').status, 2);
    assert.match(f.run('validate').stderr, /activity|property name|enum|profile/i);
  }

  /** One declared activity: position, model, bound operations and its own direction. */
  private activity(role: string, profile: string, instructions: string): Record<string, unknown> {
    return { role, profile, operations: [], instructions: [instructions] };
  }

  /** The leaf under test, declaring the given activities, operations and default model. */
  private leaf(
    f: ComponentFixture,
    activities: Record<string, unknown>,
    operations?: Record<string, string[]>,
  ): unknown {
    return f.component('sample', 'library', {
      parentId: 'package',
      owns: ['src', 'docs', 'tests'],
      api: [{ module: 'src/value.ts' }],
      ...(operations ? { operations } : {}),
      activities,
    });
  }

  /** Platform authority plus one shared finite check owned by a dedicated component. */
  private execution(f: ComponentFixture): void {
    f.put(
      '.arc/architecture/components/platform.json',
      f.component('platform', 'platform', {
        executionProfile: 'luna',
        reads: ['.'],
        director: { component: 'sample', profile: 'sol' },
        reviewerProfile: 'sol',
        activities: selectedActivities('sol'),
      }),
    );
    f.put(
      '.arc/architecture/components/operations.json',
      f.component('operations', 'library', {
        parentId: 'maintenance-package',
        owns: ['.arc/architecture/operations'],
      }),
    );
    this.operation(f);
  }

  /** Owns the shared check and supplies its literal command definition. */
  private operation(f: ComponentFixture): void {
    f.put('.arc/architecture/operations/check.json', {
      schemaVersion: 4,
      id: 'check',
      purpose: 'Check behavior',
      repository: 'sample',
      kind: 'command',
      command: 'node',
      args: ['--version'],
      cwd: '.',
      category: 'unit-test',
      prerequisites: [],
      generatedDirectories: [],
      artifacts: [],
    });
  }

  /** Supplies the two profiles the scenarios route work through. */
  private fixture(t: TestContext): ComponentFixture {
    const f = new ComponentFixture(t);
    f.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    f.put('.arc/architecture/execution-profiles/sol.json', this.profile('test-sol'));
    return f;
  }

  /** Keeps the profile's complete execution semantics in one definition. */
  private profile(model: string) {
    return {
      schemaVersion: 3,
      id: 'sol',
      model,
      reasoning: 'medium',
      webSearch: 'disabled',
      operationCategories: ['unit-test'],
    };
  }
}

const scenarios = new ActivityProfileScenarios();

test('a component holds only the activities it declares', (t) => scenarios.ownDeclaration(t));

test('assignment captures activity settings without affecting director selections', (t) =>
  scenarios.capture(t));

test('an activity model cannot widen operation availability', (t) =>
  scenarios.operationAuthority(t));

test('unknown activity profiles fail catalog validation', (t) =>
  scenarios.invalid(t, 'research', 'missing'));

test('unknown activity names fail schema validation', (t) =>
  scenarios.invalid(t, 'reseach', 'sol'));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
