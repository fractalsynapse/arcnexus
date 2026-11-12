import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { ComponentFixture, selectedActivities } from '../support/component-fixture.js';
import { resolveAssignment } from '../../../../dist/library/architecture/assignment.js';
import { loadCatalog } from '../../../../dist/library/architecture/components.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises optional activity policy through the real revision-bound catalog and CLI. */
class ActivityProfileScenarios {
  /** Child overrides replace only their named activity and preserve unrelated ancestor choices. */
  inheritance(t: TestContext): void {
    const f = this.fixture(t);
    f.put(
      'architecture/components/package.json',
      f.component('package', 'package', {
        parentId: 'platform',
        root: 'package',
        activityProfiles: { research: 'luna' },
      }),
    );
    f.commit();
    const result = f.run('validate');
    assert.equal(result.status, 0, result.stderr);
    const catalog = loadCatalog(f.root, f.git('rev-parse', 'HEAD'));
    const leaf = catalog.components.sample!;
    assert.equal(leaf.executionProfile, 'luna');
    assert.deepEqual(leaf.activityProfiles, { research: 'luna', testing: 'sol', review: 'sol' });
    assert.deepEqual(leaf.policy!['activityProfiles.research'], {
      value: 'luna',
      source: 'package',
    });
    assert.deepEqual(leaf.policy!['activityProfiles.testing'], {
      value: 'sol',
      source: 'platform',
    });
    f.put('architecture/execution-profiles/sol.json', this.profile('altered'));
    assert.equal(loadCatalog(f.root, f.git('rev-parse', 'HEAD')).profiles.sol!.model, 'test-sol');
  }

  /** Assignments retain profile contents, while explicit director/verifier selections remain separate. */
  capture(t: TestContext): void {
    const f = this.fixture(t);
    this.execution(f);
    f.commit();
    const base = f.git('rev-parse', 'HEAD');
    const options = { objective: 'Research current behavior', kind: 'research' };
    const captured = resolveAssignment(f.root, base, 'sample', options);
    assert.equal(captured.executionProfile.id, 'luna');
    assert.equal(captured.activities.research!.profile!.model, 'test-sol');
    assert.equal(captured.activities.testing!.profile!.id, 'sol');
    const director = resolveAssignment(f.root, base, 'sample', {
      ...options,
      executionProfile: 'sol',
    });
    assert.equal(director.executionProfile.id, 'sol');
    // An explicit caller profile replaces activity routing everywhere, not just the default.
    assert.equal(director.activities.research!.profile!.id, 'sol');
    assert.equal(director.activities.testing!.profile!.id, 'sol');
    f.put('architecture/execution-profiles/sol.json', this.profile('new-model'));
    f.commit();
    assert.equal(captured.activities.research!.profile!.model, 'test-sol');
  }

  /** Alternate models cannot bypass the captured operation-category policy. */
  operationAuthority(t: TestContext): void {
    const f = this.fixture(t);
    this.execution(f);
    f.put('architecture/execution-profiles/sol.json', {
      ...this.profile('test-sol'),
      operationCategories: [],
    });
    f.commit();
    assert.match(f.run('validate').stderr, /Operation category not permitted/);
  }

  /**
   * Declares the platform whose activities select positions and models.
   *
   * The platform carries no role: each activity names the position, the model that work runs under,
   * its operations and its own direction, which is what the resolved policy is expected to show.
   */
  private platform(f: ComponentFixture): void {
    f.put(
      'architecture/components/platform.json',
      f.component('platform', 'platform', {
        executionProfile: 'luna',
        reads: ['.'],
        director: { component: 'sample', profile: 'sol' },
        reviewerProfile: 'sol',
        activities: selectedActivities('sol'),
      }),
    );
  }

  /** Provides the required director and one shared finite check for executable assignments. */
  private execution(f: ComponentFixture): void {
    this.platform(f);
    f.put(
      'architecture/components/package.json',
      f.component('package', 'package', {
        parentId: 'platform',
        root: 'package',
        operations: { check: ['verify'] },
      }),
    );
    this.operation(f);
  }

  /** Owns the shared check and supplies its literal command definition. */
  private operation(f: ComponentFixture): void {
    f.put(
      'architecture/components/operations.json',
      f.component('operations', 'library', {
        parentId: 'maintenance-package',
        owns: ['architecture/operations'],
      }),
    );
    f.put('architecture/operations/check.json', {
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

  /** Missing profile references and misspelled activity names fail before execution. */
  invalid(t: TestContext, activity: string, profile: string): void {
    const f = this.fixture(t);
    f.put(
      'architecture/components/package.json',
      f.uncheckedComponent('package', 'package', {
        parentId: 'platform',
        root: 'package',
        activityProfiles: { [activity]: profile },
      }),
    );
    f.commit();
    const result = f.run('validate');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /activity|property name|enum/i);
  }

  /** Supplies shared profiles without adding model choices to component leaves. */
  private fixture(t: TestContext): ComponentFixture {
    const f = new ComponentFixture(t);
    f.git('remote', 'add', 'origin', 'https://example.invalid/sample.git');
    f.put('architecture/execution-profiles/sol.json', this.profile('test-sol'));
    f.put(
      'architecture/components/platform.json',
      // Per-activity profiles are authored on the activities themselves; a leaf declares no model
      // choice, so the resolved policy must still show the platform's selection for each activity.
      f.component('platform', 'platform', {
        executionProfile: 'luna',
        reads: ['.'],
        activities: selectedActivities('sol'),
      }),
    );
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

test('assignment captures activity settings without affecting director selections', (t) =>
  scenarios.capture(t));

test('activity profile overrides cannot widen operation availability', (t) =>
  scenarios.operationAuthority(t));

test('activity profiles inherit independently and remain revision-bound', (t) =>
  scenarios.inheritance(t));

test('unknown activity profiles fail catalog validation', (t) =>
  scenarios.invalid(t, 'research', 'missing'));

test('unknown activity names fail schema validation', (t) =>
  scenarios.invalid(t, 'reseach', 'sol'));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
