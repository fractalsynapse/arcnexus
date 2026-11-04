import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { ConfigurationReader } from '../../../../dist/library/architecture/configuration.js';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Checks real project inheritance and host path resolution for shared engineering tools. */
class ProjectOperationScenarios {
  private readonly context = new ExecutionContext().resolve(process.cwd());

  /** Executes the actual inherited validation recipe so retired CLI spellings cannot break real baselines. */
  validation(): void {
    const { catalog, owners, source } = this.context;
    const operations = owners.flatMap((id) =>
      catalog.components[id]!.operationPlan!.delivery!.filter(
        (operation) => operation.id === 'migrated-recipe-f36c9dcd75620b35',
      ),
    );
    assert.equal(
      operations.length,
      owners.length,
      'Every steward must inherit assembled delivery validation',
    );
    const operation = operations[0]!;
    assert.ok(operation.kind === 'command');
    const result = spawnSync(operation.command, operation.args, {
      cwd: resolve(source, operation.cwd),
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'valid');
    assert.equal(report.guidance.status, 'valid');
  }

  /** Every executable owner receives shared tools without maintaining a second ownership directory list. */
  inherited(): void {
    const { catalog, owners } = this.context;
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
      assert.deepEqual(
        source.value,
        new ConfigurationReader().parse(source.path, source.text).value,
      );
      const component = source.value as any;
      if (component.schemaVersion !== 5 || component.type === 'platform') continue;
      assert.ok(!component.operations?.['component-lint']);
      assert.ok(!component.operations?.['component-tests']?.includes('agent'));
    }
  }

  /** Engineering checks use one inherited owner policy and profile while assembled checks retain whole-repository scope. */
  scoped(): void {
    const { catalog, owners } = this.context;
    for (const id of owners) {
      const owner = catalog.components[id]!;
      const checks = owner.operationPlan!.verify!;
      assert.ok(
        checks.some((op) => op.id === 'component-lint'),
        id,
      );
      assert.ok(
        checks.some((op) => op.id === 'component-tests' && op.profileVerification === 'node'),
        id,
      );
      assert.ok(!checks.some((op) => op.id === 'migrated-recipe-719d77e27c5d9798'), id);
      assert.ok(
        !checks.some(
          (op) => op.kind === 'command' && op.command === 'npm' && op.args.includes('lint'),
        ),
        id,
      );
      assert.ok(
        owner.operationPlan!.delivery!.some((op) => op.id === 'migrated-recipe-719d77e27c5d9798'),
        id,
      );
    }
  }

  /** Formatting shares one read-only command and derives each owner's proposal paths. */
  formatting(): void {
    const { catalog, owners } = this.context;
    for (const id of owners) {
      const owner = catalog.components[id]!;
      const formatter = owner.operationPlan!.agent!.find((op) => op.id === 'component-format');
      assert.ok(formatter && formatter.kind === 'command', id + ' needs checked formatting');
      assert.deepEqual(formatter.args, [
        'scripts/foundation/format-proposal.mjs',
        ...owner.allowedWritePaths,
      ]);
      assert.deepEqual(formatter.generatedDirectories, []);
    }
  }
}

const scenarios = new ProjectOperationScenarios();

test('real project captured verification invokes comprehensive architecture and guidance validation', () =>
  scenarios.validation());

test('real project inherits one shared lint and test availability definition per owner', () =>
  scenarios.inherited());

test('real project derives checked formatting proposals from inherited ownership', () =>
  scenarios.formatting());

test('engineering checks are owner-scoped while assembled delivery retains full checks', () =>
  scenarios.scoped());

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
