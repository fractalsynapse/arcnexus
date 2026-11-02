import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Checks real project inheritance and host path resolution for shared engineering tools. */
class ProjectOperationScenarios {
  /** Every executable owner receives shared tools without maintaining a second ownership directory list. */
  inherited(): void {
    const { catalog, owners } = new ExecutionContext().resolve(process.cwd());
    for (const id of owners) {
      const owner = catalog.components[id]!;
      const lint = owner.operationPlan!.agent!.find(
        (operation) => operation.id === 'component-lint',
      );
      assert.ok(lint && lint.kind === 'command', id + ' needs inherited lint');
      assert.deepEqual(lint.args.slice(3), owner.allowedWritePaths);
      assert.deepEqual(lint.generatedDirectories, []);
      assert.ok(
        owner.operationPlan!.agent!.some((operation) => operation.id === 'component-tests'),
      );
    }
    for (const source of catalog.configurationSources) {
      const component = source.value as any;
      if (component.schemaVersion !== 5 || component.type === 'platform') continue;
      assert.ok(!component.operations?.['component-lint']);
      assert.ok(!component.operations?.['component-tests']?.includes('agent'));
    }
  }
}

const scenarios = new ProjectOperationScenarios();

test('real project inherits one shared lint and test availability definition per owner', () =>
  scenarios.inherited());

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
