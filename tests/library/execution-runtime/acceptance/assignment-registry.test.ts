import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Exercises engineering discovery and explicit supplier reuse through the real MCP and scheduler boundaries. */
class AssignmentRegistryScenario {
  /** Discovers a not-started supplier without granting checkpoint access or creating duplicate assignments. */
  async run(t: TestContext): Promise<void> {
    const f = new GeneralFixture(t).fixture;
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.close());
    const run = host.submit('LINK_EXISTING_WORK: share the starting supplier');
    await host.tick();
    const sender = host.store.assignments(run.id).find((item) => item.owner === 'a')!;
    const supplier = host.store.assignments(run.id).find((item) => item.owner === 'b')!;
    const unrelated = host.store.enqueue(run.id, 'c', 'Unrelated current work');
    host.store.updateAssignment(unrelated.id, 'ready', { recordId: 'PRIVATE_RECORD_SENTINEL' });
    const foreign = host.store.createRun('task', ['b'], 'FOREIGN_RUN_SENTINEL');
    host.store.enqueue(foreign.id, 'b', 'FOREIGN_WORK_SENTINEL');
    await host.tick();
    assert.equal(host.store.assignments(run.id).length, 3);
    assert.deepEqual(host.store.assignment(sender.id).dependencies, [supplier.id]);
    assert.equal(host.store.assignment(supplier.id).data.recordId, undefined);
    const record = host.store.assignment(sender.id).data.recordId;
    const retained = JSON.parse(
      readFileSync(join(f.state, 'runs', String(record), 'report.json'), 'utf8'),
    );
    assert.equal(retained.resolvedAssignment.assignment.kind, 'change');
    assert.equal(Object.hasOwn(retained.resolvedAssignment.assignment, 'allowedWritePaths'), false);
    assert.ok(retained.resolvedAssignment.context.at(-1).allowedWritePaths.includes('new.txt'));
    this.evidence(f.calls, run.id, sender.id, supplier.id);
  }

  /** Proves exact host intent was read, while foreign runs and private record evidence remain unavailable. */
  private evidence(path: string, runId: string, sender: string, supplier: string): void {
    const text = readFileSync(path + '.evidence', 'utf8').trim();
    const observed = JSON.parse(text);
    assert.equal(observed.manifest.runId, runId);
    assert.equal(observed.manifest.assignmentId, sender);
    assert.equal(observed.manifest.records, undefined);
    assert.equal(observed.manifest.assignments.length, 2);
    const entry = observed.manifest.assignments.find((item: any) => item.assignmentId === supplier);
    const intent = JSON.parse(observed.artifacts[entry.artifact]);
    assert.equal(intent.owner, 'b');
    assert.equal(intent.status, 'ready');
    assert.equal(intent.accepted, false);
    assert.equal(intent.objective, 'Supply shared evidence');
    assert.deepEqual(intent.acceptance, ['Evidence-backed result']);
    assert.doesNotMatch(text, /PRIVATE_RECORD_SENTINEL|FOREIGN_RUN_SENTINEL|FOREIGN_WORK_SENTINEL/);
    assert.ok(observed.manifest.artifacts.every((item: any) => item.id.endsWith(':intent')));
  }
}

test('engineering discovers current-run supplier intent and links existing work through MCP', (t) =>
  new AssignmentRegistryScenario().run(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
