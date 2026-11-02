import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import * as components from '../../../../dist/library/architecture/components.js';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises real catalog scale without replacing captured authority with its model projection. */
class ModelContextScenarios {
  /** Every owner keeps intent, public boundaries and cross-owner discovery while snapshots remain immutable. */
  project(): void {
    const context = new ExecutionContext().resolve(resolve('.'));
    const project = Reflect.get(components, 'componentContext') as (
      owner: components.Component,
    ) => any;
    assert.equal(typeof project, 'function');
    const before = JSON.stringify(context.catalog);
    const views = context.owners.map((id) => project(context.catalog.components[id]!));
    for (const view of views) {
      const owner = context.catalog.components[view.id]!;
      assert.deepEqual(view.allowedWritePaths, owner.allowedWritePaths);
      assert.deepEqual(view.publicApi, owner.publicApi);
      assert.deepEqual(view.constraints, owner.constraints);
      assert.deepEqual(view.observedConsumers, owner.observedConsumers);
      assert.ok(view.observedImports.every((entry: any) => entry.owner !== owner.id));
      this.imports(owner, view);
      assert.equal(view.operationPlan, undefined);
      assert.equal(view.inventory, undefined);
      assert.equal(view.capturedTests, undefined);
    }
    assert.equal(JSON.stringify(context.catalog), before);
    assert.ok(
      JSON.stringify(views).length < 700000,
      'Leave room for goal and review context within observed native input limit',
    );
  }

  /** Grouping retains the evidence needed to locate every observed cross-owner or unresolved reference. */
  private imports(owner: components.Component, view: any): void {
    for (const original of owner.observedImports ?? []) {
      if (original.owner === owner.id) continue;
      assert.ok(
        view.observedImports.some(
          (entry: any) =>
            entry.owner === original.owner &&
            entry.module === original.module &&
            entry.target === original.target &&
            entry.typeOnly === original.typeOnly &&
            entry.unresolved === original.unresolved &&
            entry.sources.includes(original.source) &&
            original.symbols.every((symbol) => entry.symbols.includes(symbol)),
        ),
      );
    }
  }
}

const scenarios = new ModelContextScenarios();

test('real project model context preserves boundaries without duplicate execution snapshots', () =>
  scenarios.project());

registerSuite({ component: 'architecture', level: 'acceptance', tags: ['deterministic'] });
