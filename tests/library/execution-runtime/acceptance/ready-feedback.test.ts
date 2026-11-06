import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import type { RecordData } from '../../../../dist/library/workspace/state.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Exercises feedback at the retained boundary between finished engineering and delivery acceptance. */
class ReadyFeedbackScenario {
  /** New feedback reaches a model once while unchanged feedback does not replay completed engineering. */
  async run(t: TestContext): Promise<void> {
    const f = new GeneralFixture(t).fixture;
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.store.close());
    const run = host.submit('Inspect retained evidence');
    host.store.updateRun(run.id, 'running', { initialized: true });
    const assignment = host.store.enqueue(run.id, 'c', 'Inspect retained evidence', ['Observed']);
    host.store.updateAssignment(assignment.id, 'ready', { proposal: { kind: 'research' } });
    await host.tick();
    await host.tick();
    assert.equal(host.store.assignment(assignment.id).status, 'completed');
    const recordId = String(host.store.assignment(assignment.id).data.recordId);
    const before = this.record(f.state, recordId).turns.length;
    host.store.updateAssignment(assignment.id, 'ready', {
      continuationReason: 'Inspect new finding',
    });
    await host.tick();
    const after = this.record(f.state, recordId);
    assert.ok(after.turns.length > before);
    assert.equal(after.continuationFeedback, 'Inspect new finding');
    host.store.updateAssignment(assignment.id, 'ready');
    await host.tick();
    assert.equal(this.record(f.state, recordId).turns.length, after.turns.length);
  }

  /** Reads host-retained turn evidence independently of the controlled model's completion claim. */
  private record(root: string, id: string): RecordData & { turns: unknown[] } {
    return JSON.parse(readFileSync(join(root, 'runs', id, 'report.json'), 'utf8')) as RecordData & {
      turns: unknown[];
    };
  }
}

test('ready finished engineering consumes fresh feedback without replaying unchanged feedback', (t) =>
  new ReadyFeedbackScenario().run(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'recovery'],
});
