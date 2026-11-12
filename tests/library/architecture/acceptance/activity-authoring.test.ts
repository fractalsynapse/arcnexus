import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { ComponentFixture } from '../support/component-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** The four fields every declared component activity must state, per the activity model. */
const ACTIVITY_FIELDS = ['role', 'profile', 'operations', 'instructions'] as const;

/**
 * Proves that validation, not documentation, requires a complete activity.
 *
 * The ruling is that each declared activity states its position, model, bound operations and its own
 * direction. A schema is only a claim until something refuses a document that breaks it, so this
 * drives the built CLI once per omitted field: a component may not declare an activity that leaves
 * any of the four out, and the refusal names the missing field rather than a bystander.
 */
class ActivityAuthoringScenarios {
  /** Refuses each incomplete activity and reports which field was missing. */
  incomplete(t: TestContext): void {
    const f = new ComponentFixture(t);
    f.put('package/incomplete/notes.md', 'A scope nothing else owns.\n');
    for (const missing of ACTIVITY_FIELDS) {
      // Deliberately malformed on purpose: only `uncheckedComponent` lets a scenario author
      // what production must refuse, rather than validating the fixture before testing it.
      const declaration = f.uncheckedComponent('incomplete', 'library', {
        parentId: 'package',
        owns: ['incomplete'],
        activities: {
          research: {
            role: 'engineer',
            profile: 'luna',
            operations: [],
            instructions: ['Record what the owned scope does'],
          },
        },
      });
      delete declaration.activities.research[missing];
      f.put(`architecture/components/incomplete-${missing}.json`, declaration);
      f.commit();
      const result = f.run('validate');
      assert.equal(result.status, 2, `omitting ${missing} must be refused: ${result.stdout}`);
      assert.match(
        result.stderr,
        new RegExp(`must have required property '${missing}'`),
        result.stderr,
      );
    }
  }

  /** Accepts an activity that states all four fields, so the rule above is not over-strict. */
  complete(t: TestContext): void {
    const f = new ComponentFixture(t);
    f.put('package/complete/notes.md', 'A scope nothing else owns.\n');
    f.put(
      'architecture/components/complete.json',
      f.component('complete', 'library', {
        parentId: 'package',
        owns: ['complete'],
        activities: {
          research: {
            role: 'engineer',
            profile: 'luna',
            operations: [],
            instructions: ['Record what the owned scope does'],
          },
        },
      }),
    );
    f.commit();
    const result = f.run('validate');
    assert.equal(result.status, 0, result.stderr);
  }
}

const scenarios = new ActivityAuthoringScenarios();

test('validate refuses an activity omitting each required field by name', (t) =>
  scenarios.incomplete(t));

test('validate accepts an activity that states all four supported fields', (t) =>
  scenarios.complete(t));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
