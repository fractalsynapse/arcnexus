import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { resolveAssignment } from '../../../../dist/library/architecture/assignment.js';
import { loadBindings } from '../../../../dist/library/architecture/bindings.js';
import { StewardSession } from '../../../../dist/library/assignment/steward.js';
import type { RecordData } from '../../../../dist/library/workspace/state.js';
import { createWorkspace } from '../../../../dist/library/workspace/workspace.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { minimalWorkflowFixture } from '../../testing/support/workflow-fixture.js';

/** Keeps prepared engineering distinct from verified acceptance through real checked edits and confined tests. */
class PreparedWorkflowScenario {
  /** A related contribution can hand off observed red checks without marking host acceptance complete. */
  async run(t: TestContext): Promise<void> {
    const fixture = minimalWorkflowFixture(t, 'repair');
    const bindings = loadBindings(join(fixture.root, 'minimal-bindings.json'));
    const base = fixture.git('rev-parse', 'HEAD');
    const resolved = resolveAssignment(fixture.repo, base, 'sample', {
      objective: 'Implement behavior',
      bindings,
    });
    mkdirSync(join(fixture.state, 'runs'), { recursive: true });
    const record = createWorkspace(fixture.state, { project: fixture.repo, base, bindings });
    record.resolvedAssignment = resolved;
    record.directionAccepted = true;
    record.contributionGroup = ['controlled-owner', 'controlled-peer'];
    await new StewardSession(
      fixture.state,
      record,
      'sample',
      resolved.assignment.objective,
      resolved.executionProfile.model,
      fixture.executable,
      new AbortController().signal,
    ).run();
    this.prepared(record);
  }

  /** Confirms failing observations remain visible and no checklist or candidate acceptance is fabricated. */
  private prepared(record: RecordData): void {
    assert.equal(record.status, 'prepared');
    assert.equal(record.outcome, 'prepared_for_assembly');
    assert.deepEqual(
      (record.turns as any[]).map((turn) => turn.activity),
      ['planning', 'specification', 'implementation', 'review'],
    );
    assert.equal(readFileSync(join(record.workspace, 'source.txt'), 'utf8'), 'broken');
    assert.ok(record.commands.some((command) => command.exitCode !== 0));
    assert.equal((record.plan as any).hostChecks[0].status, 'pending');
    assert.equal(record.finalVerifiedDigest, undefined);
  }
}

test('related engineering prepares source without misrepresenting failed checks as delivery', (t) =>
  new PreparedWorkflowScenario().run(t));

registerSuite({
  component: 'assignment',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
