import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CodexConfiguration } from '../../../../dist/library/steward/codex-configuration.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Requires minimal captured authority before constructing any executable model permission profile. */
class RetiredModelScenarios {
  /** Old writable directory grants cannot select a legacy sandbox implementation. */
  owner(): void {
    assert.throws(
      () => new CodexConfiguration({ record: { context: [{ schemaVersion: 4 }] } } as any),
      /version.five.*migrat/i,
    );
  }

  /** An absent profile must not silently select model or permission defaults. */
  profile(): void {
    assert.throws(
      () => new CodexConfiguration({ record: { context: [{ schemaVersion: 5 }] } } as any),
      /captured execution profile/i,
    );
  }
}

const scenarios = new RetiredModelScenarios();

test('model execution rejects legacy writable owner authority before filesystem access', () =>
  scenarios.owner());

test('model execution requires an explicit captured profile', () => scenarios.profile());

registerSuite({ component: 'steward', level: 'acceptance', tags: ['deterministic'] });
