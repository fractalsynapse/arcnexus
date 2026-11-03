import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { ComponentV5Fixture } from '../support/component-v5-fixture.js';

/** Exposes malformed setup before an unrelated missing API can become regression evidence. */
class RegressionFixtureScenarios {
  /** Rejects missing authority in ordinary declarations before the behavioral assertion is reached. */
  rejectsSetup(t: TestContext, version: 5 | 6): void {
    const fixture = new ComponentV5Fixture(t, version);
    let reachedBehavior = false;
    assert.throws(() => {
      fixture.component('deep', 'library', { parentId: 'package' });
      reachedBehavior = true;
      assert.fail('ComponentResources exported publicly');
    }, /Invalid component-v[56].*owns/);
    assert.equal(reachedBehavior, false);
    assert.throws(() => fixture.component('orphan', 'package'), /parentId/);
    assert.throws(() => fixture.component('bad', 'platform', { path: '.' }), /additional/);
  }
}

const scenarios = new RegressionFixtureScenarios();

for (const version of [5, 6] as const)
  test(`v${version} regression fixtures reject invalid setup before missing behavior`, (t) =>
    scenarios.rejectsSetup(t, version));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
