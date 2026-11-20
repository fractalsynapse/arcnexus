import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { CheckCacheFixture, fixtureOperation } from '../fixtures/check-cache.js';

export const suite = {
  owner: 'execution',
  level: 'integration',
  tags: ['native', 'regression'],
} as const;

/** Exercise actual confined argv forwarding and the retained check cache across activity bindings. */
class ParameterScenario {
  private readonly task;

  /** Configure two activities against one authored operation using the existing check fixture. */
  constructor(context: TestContext) {
    this.task = new CheckCacheFixture(context).task;
    const task = this.task;
    Object.assign(task.capture.operations['fixture-check']!, {
      ...fixtureOperation,
      command: '/usr/bin/printf',
      args: ['%s', { parameter: 'tag' }],
      parameters: { tag: { type: 'string', default: 'default-tag' } },
    });
    Object.assign(task.capture.components.owner!.activities, {
      testing: { operations: [{ operation: 'fixture-check', parameters: { tag: 'testing-tag' } }] },
      implementation: {
        operations: [{ operation: 'fixture-check', parameters: { tag: 'implementation-tag' } }],
      },
    });
  }

  /** Require distinct real command observations and cache identities for the configured arguments. */
  async verify() {
    const signal = new AbortController().signal;
    const testing = await this.task.check('fixture-check', signal, {
      owner: 'owner',
      activity: 'testing',
      expected: 'pass',
    });
    const implementation = await this.task.check('fixture-check', signal, {
      owner: 'owner',
      activity: 'implementation',
      expected: 'pass',
    });
    assert.equal(testing.status, 0);
    assert.equal(implementation.status, 0);
    assert.deepEqual(testing.args, ['%s', 'testing-tag']);
    assert.deepEqual(implementation.args, ['%s', 'implementation-tag']);
    assert.notEqual(testing.log, implementation.log);
  }
}

test(
  'configured activity arguments reach the real confined operation and remain distinct cache inputs',
  { skip: process.env.ARCNEXUS_NATIVE_TESTS !== '1' },
  (context) => new ParameterScenario(context).verify(),
);
