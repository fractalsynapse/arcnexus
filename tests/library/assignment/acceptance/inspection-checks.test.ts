import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cli } from '../../testing/support/workflow-fixture.js';
import { test } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Inspects captured check policy through the built CLI without a native harness or model activation. */
class InspectionCheckScenarios {
  /** Keeps owner regression checks separate from mandatory assembled-delivery verification. */
  inspectOwnerAndDeliveryChecks() {
    const r = spawnSync(
      process.execPath,
      [cli, 'inspect', 'report', 'Improve evidence', '--project', process.cwd(), '--json'],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
    assert.equal(r.status, 0, String(r.error ?? r.stderr));
    const inspected = JSON.parse(r.stdout);
    const commands = inspected.verification;
    const fullSuite = (c: any) =>
      c.command === 'node' && c.args.join(' ') === '--test .test-build/**/*.test.js';
    assert.ok(!commands.some(fullSuite));
    assert.ok(inspected.context.at(-1).operationPlan.delivery.some(fullSuite));
    assert.ok(
      commands.some(
        (c: any) =>
          c.id === 'component-tests' &&
          c.command === 'node' &&
          c.args.includes('.test-build/library/report/unit/report.test.js'),
      ),
      'focused report regression is captured',
    );
  }
}

const scenario = new InspectionCheckScenarios();

test('built inspect separates owner regression from assembled repository verification', () =>
  scenario.inspectOwnerAndDeliveryChecks());

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'scoped-checks'],
});
