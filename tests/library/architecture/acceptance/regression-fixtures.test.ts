import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { ComponentV5Fixture } from '../support/component-v5-fixture.js';

/** Guards that malformed declarations are rejected by the single component shape, so a broken
 * fixture cannot masquerade as a behavioural regression. */
class RegressionFixtureScenarios {
  /** Rejects missing authority in ordinary declarations before the behavioral assertion is reached. */
  rejectsSetup(t: TestContext): void {
    const fixture = new ComponentV5Fixture(t);
    let reachedBehavior = false;
    assert.throws(() => {
      fixture.component('deep', 'library', { parentId: 'package' });
      reachedBehavior = true;
      assert.fail('ComponentResources exported publicly');
    }, /Invalid component-v6.*owns/);
    assert.equal(reachedBehavior, false);
    assert.throws(() => fixture.component('orphan', 'package'), /parentId/);
    assert.throws(() => fixture.component('bad', 'platform', { path: '.' }), /additional/);
  }
}

const scenarios = new RegressionFixtureScenarios();

test('regression fixtures reject invalid setup before missing behavior', (t) =>
  scenarios.rejectsSetup(t));

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
