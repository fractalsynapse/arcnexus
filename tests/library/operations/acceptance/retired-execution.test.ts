import assert from 'node:assert/strict';
import { test } from 'node:test';
import { operationBridge } from '../../../../dist/library/operations/operations.js';
import { ServiceManager } from '../../../../dist/library/operations/services.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Rejects historical executable records before filesystem setup or managed process launch. */
class RetiredExecutionScenarios {
  /** Does not construct an executable bridge from an old captured operation catalog. */
  bridge(): void {
    const record: any = { resolvedAssignment: { operations: [{ schemaVersion: 3 }] } };
    assert.throws(
      () => operationBridge('/unused', record, new AbortController().signal, () => {}),
      /schema.4.*migrat/i,
    );
  }

  /** The public service manager refuses legacy startup before inspecting a workspace or executable. */
  async service(): Promise<void> {
    const manager = new ServiceManager('/unused', {} as any, new AbortController().signal);
    await assert.rejects(
      manager.start({ schemaVersion: 3, kind: 'service', service: {} } as any),
      /schema.4.*migrat/i,
    );
  }
}

const scenarios = new RetiredExecutionScenarios();

test('operation bridge rejects historical executable authority before dispatch', () =>
  scenarios.bridge());

test('service manager rejects historical executable authority before startup', () =>
  scenarios.service());

registerSuite({ component: 'operations', level: 'acceptance', tags: ['deterministic'] });
