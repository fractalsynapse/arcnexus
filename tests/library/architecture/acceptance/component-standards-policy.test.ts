import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { ComponentFixture, selectedActivities } from '../support/component-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises type discrimination and inherited authority through the built catalog loader. */
class ComponentPolicyScenarios {
  /** Every executable type shares the same minimal ownership contract. */
  executable(t: TestContext, type: string): void {
    const fixture = new ComponentFixture(t);
    fixture.put(
      'architecture/components/unrelated-filename.json',
      fixture.component('sample', type, {
        parentId: 'package',
        owns: ['src', 'docs', 'tests'],
      }),
    );
    fixture.commit();
    const result = fixture.run('validate');
    assert.equal(result.status, 0, result.stderr);
  }

  /**
   * Requires each activity to state its own authority.
   *
   * A component declares no role, so the position and model live on the activity that uses them.
   * Dropping either one must be a load failure: silently selecting a fallback model or leaving work
   * without an accountable position is the hazard this scenario guards.
   */
  missing(t: TestContext, field: string): void {
    const fixture = new ComponentFixture(t);
    const platform = fixture.uncheckedComponent('platform', 'platform', {
      executionProfile: 'luna',
      reads: ['.'],
      activities: selectedActivities('luna'),
    });
    const activities = platform.activities as Record<string, any>;
    delete activities.research[field];
    fixture.put('architecture/components/platform.json', platform);
    fixture.commit();
    const result = fixture.run('validate');
    assert.equal(result.status, 2);
    // Same guarantee, current wording: an activity that names no position or no model is refused at
    // load rather than silently selecting a fallback. The message this asserted named a field the
    // component shape no longer has.
    assert.match(result.stderr, /must have required property '(role|profile)'/);
  }

  /** Containers cannot acquire write authority through fields intended only for executable owners. */
  container(t: TestContext): void {
    const fixture = new ComponentFixture(t);
    fixture.put(
      'architecture/components/package.json',
      fixture.uncheckedComponent('package', 'package', {
        parentId: 'platform',
        root: 'package',
        owns: ['.'],
      }),
    );
    fixture.commit();
    const result = fixture.run('validate');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /additional/);
  }

  /** Local paths cannot escape their declaring package before normalization. */
  traversal(t: TestContext): void {
    const fixture = new ComponentFixture(t);
    fixture.put(
      'architecture/components/unrelated-filename.json',
      fixture.component('sample', 'library', {
        parentId: 'package',
        owns: ['../package'],
      }),
    );
    fixture.commit();
    assert.match(fixture.run('validate').stderr, /Invalid relative path/);
  }
}

const scenarios = new ComponentPolicyScenarios();

for (const type of ['foundation', 'gateway', 'library', 'release'])
  test(`resolves minimal ${type}`, (t) => scenarios.executable(t, type));

for (const field of ['role', 'profile'])
  test(`requires the authority each activity declares: ${field}`, (t) =>
    scenarios.missing(t, field));

test('rejects container ownership', (t) => scenarios.container(t));

test('rejects package-relative traversal', (t) => scenarios.traversal(t));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
