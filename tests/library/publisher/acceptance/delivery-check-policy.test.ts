import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import type {
  ExecutionRun,
  ExecutionAssignment,
} from '../../../../dist/library/coordination-store/execution-types.js';
import { DeliveryChecks } from '../../../../dist/library/publisher/delivery-checks.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Checks assembled publication policy through actual workspace and supervised operation wiring. */
class DeliveryCheckPolicyScenario {
  /** Adds an independently failing check without changing engineering requirements. */
  private policy(repo: string): void {
    const path = join(repo, 'architecture/components/platform.json');
    const platform = JSON.parse(readFileSync(path, 'utf8'));
    platform.operations['delivery-proof'] = ['delivery'];
    writeFileSync(path, JSON.stringify(platform));
    writeFileSync(
      join(repo, 'architecture/operations/delivery-proof.json'),
      JSON.stringify({
        schemaVersion: 4,
        id: 'delivery-proof',
        kind: 'command',
        repository: 'sample',
        purpose: 'Require assembled delivery evidence',
        cwd: '.',
        category: 'cli-check',
        activities: [],
        command: 'node',
        args: ['-e', 'process.exit(7)'],
        generatedDirectories: [],
        artifacts: [],
        prerequisites: [],
      }),
    );
  }

  /** Requires a delivery-only failure to block publication and retain the actual command evidence. */
  async run(t: TestContext): Promise<void> {
    const general = new GeneralFixture(t);
    const f = general.fixture;
    this.policy(f.repo);
    f.commit();
    const context = new ExecutionContext().resolve(f.repo);
    assert.ok(
      !context.catalog.components.a!.verification.some(
        (op) => 'id' in op && op.id === 'delivery-proof',
      ),
    );
    const run = {
      id: 'delivery-policy',
      mode: 'task',
      objective: 'Verify assembled policy',
    } as ExecutionRun;
    const assignments = [
      { owner: 'a', acceptance: ['Observed checks pass'] },
    ] as ExecutionAssignment[];
    const result = await new DeliveryChecks(f.state, context, run, assignments).check(
      context.base,
      new AbortController().signal,
    );
    assert.equal(result.status, 'failed');
    this.evidence(result.evidence[0]!);
  }

  /** Distinguishes observed check failure from missing confinement or preparation. */
  private evidence(path: string): void {
    const report = JSON.parse(readFileSync(path, 'utf8'));
    const invocation = report.operationInvocations.find(
      (entry: any) => entry.operationId === 'delivery-proof',
    );
    assert.equal(invocation.status, 'failed');
    assert.equal(invocation.result.exitCode, 7);
    assert.equal(invocation.purpose, 'publication-verify');
  }
}

test('assembled delivery executes inherited delivery-only checks and retains their failure', (t) =>
  new DeliveryCheckPolicyScenario().run(t));

registerSuite({ component: 'publisher', level: 'acceptance', tags: ['native', 'scoped-checks'] });
