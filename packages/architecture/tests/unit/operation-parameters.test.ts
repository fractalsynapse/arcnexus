import assert from 'node:assert/strict';
import test from 'node:test';
import * as architecture from '../../src/index.js';
import type { Capture } from '../../src/index.js';

export const suite = { owner: 'architecture', level: 'unit', tags: ['regression'] } as const;

/** Specify operation configuration independently of command execution or repository-specific ownership. */
class ParameterScenario {
  readonly capture = {
    operations: {
      tests: {
        id: 'tests',
        command: 'npm',
        category: 'integration-test',
        network: false,
        args: ['test', { context: 'owner' }, { parameter: 'selectors' }],
        parameters: {
          selectors: { type: 'array', items: { type: 'string' }, default: ['--tag', 'default'] },
        },
      },
    },
    components: {
      work: {
        id: 'work',
        operationParameters: { tests: { selectors: ['--tag', 'component'] } },
        activities: {
          testing: {
            operations: [
              { operation: 'tests', parameters: { selectors: ['--tag', 'regression'] } },
            ],
          },
          implementation: { operations: ['tests'] },
        },
      },
    },
  } as unknown as Capture;

  /** Exercise the shared public resolver rather than reproducing interpolation in the fixture. */
  resolve(activity?: string) {
    const resolver = (architecture as any).resolveOperation;
    assert(resolver, 'Architecture must expose one operation-parameter resolver');
    return resolver(this.capture, 'tests', 'work', activity);
  }
}

test('ARC-24: operation defaults, component configuration and activity overrides resolve in order', () => {
  const scenario = new ParameterScenario();
  assert.deepEqual(scenario.resolve('testing').args, ['test', 'work', '--tag', 'regression']);
  assert.deepEqual(scenario.resolve('implementation').args, ['test', 'work', '--tag', 'component']);
  assert.match(scenario.resolve('testing').parameterSources.selectors, /activities.testing/);
});

test('ARC-24: explicit empty argument collections replace defaults without changing the authored definition', () => {
  const scenario = new ParameterScenario();
  const binding = scenario.capture.components.work!.activities.testing!.operations[0] as any;
  binding.parameters.selectors = [];
  assert.deepEqual(scenario.resolve('testing').args, ['test', 'work']);
  assert.deepEqual((scenario.capture.operations.tests as any).parameters.selectors.default, [
    '--tag',
    'default',
  ]);
});

test('ARC-24: invalid types and unknown parameter names report the exact operation and field', () => {
  const scenario = new ParameterScenario();
  const binding = scenario.capture.components.work!.activities.testing!.operations[0] as any;
  binding.parameters.selectors = 'wrong type';
  assert.throws(() => scenario.resolve('testing'), /tests.*selectors.*array/i);
  binding.parameters = { unknown: [] };
  assert.throws(() => scenario.resolve('testing'), /tests.*unknown/i);
});

test('ARC-24: literal metacharacters stay individual arguments without shell evaluation', () => {
  const scenario = new ParameterScenario();
  const binding = scenario.capture.components.work!.activities.testing!.operations[0] as any;
  binding.parameters.selectors = ['a file; echo unexpected', '$(not-a-command)'];
  assert.deepEqual(scenario.resolve('testing').args, [
    'test',
    'work',
    'a file; echo unexpected',
    '$(not-a-command)',
  ]);
});

test('operation applicability accepts declared scope kinds and rejects unknown policy', () => {
  const scenario = new ParameterScenario();
  const operation = scenario.capture.operations.tests as any;
  for (const value of ['owner-test-suites', 'owner-format-files', 'owner-lint-files']) {
    operation.applicability = value;
    assert.equal(scenario.resolve('testing').applicability, value);
  }
  operation.applicability = 'invented-policy';
  assert.throws(() => scenario.resolve('testing'), /tests.*applicability.*invented-policy/);
});
