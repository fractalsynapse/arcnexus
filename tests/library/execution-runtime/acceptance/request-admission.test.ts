import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Exercises whole-batch scope rejection and retained-thread correction through actual scheduler activations. */
class RequestAdmissionScenario {
  /** Invalid scope creates no recipient; one read-only correction then admits the complete requested fan-out. */
  async run(t: TestContext): Promise<void> {
    const f = new GeneralFixture(t).fixture;
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.close());
    const run = host.submit('INVALID_REQUEST_SCOPE: obtain supplier evidence');
    await host.tick();
    await host.tick();
    const requester = host.store.assignments(run.id)[0]!;
    assert.equal(host.store.assignments(run.id).length, 1);
    assert.deepEqual(host.store.inbox(requester.id), []);
    const path = join(f.state, 'runs', String(requester.data.recordId), 'report.json');
    const before = JSON.parse(readFileSync(path, 'utf8'));
    assert.match(before.requestCorrection.errors[0], /widens component scope/);
    assert.equal(before.requestCorrection.requests.length, 2);
    const unrelated = host.store.enqueue(run.id, 'c', 'Unrelated retained work');
    host.store.updateAssignment(unrelated.id, 'ready', { proposal: { kind: 'research' } });
    await host.tick();
    this.corrected(host, requester.id, path, before);
    await host.tick();
    assert.ok(host.store.assignment(unrelated.id).data.recordId);
    assert.equal(host.store.assignment(requester.id).status, 'waiting');
  }

  /** Preserves authority and the suspended engineering checkpoint while routing each corrected request once. */
  private corrected(host: ProjectHost, id: string, path: string, before: any): void {
    const after = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(after.requestCorrection, undefined);
    assert.equal(after.readOnlyTurn, true);
    assert.equal(after.nextStage, before.nextStage);
    assert.deepEqual(after.plan, before.plan);
    assert.equal(after.resolvedAssignment.digest, before.resolvedAssignment.digest);
    assert.equal(after.threadId, before.threadId);
    const requests = host.store.inbox(id).filter((item) => item.from === id);
    assert.deepEqual(requests.map((item) => item.owner).sort(), ['b', 'c']);
    for (const request of requests) {
      assert.deepEqual(request.acceptance, ['Evidence-backed result']);
      assert.equal(host.store.assignment(request.assignmentId).data.recordId, undefined);
    }
    assert.equal(after.stage, 'coordination');
    assert.equal(after.safeCheckpoint, true);
  }
}

const scenario = new RequestAdmissionScenario();

test('invalid request batches are corrected before recipient activation and unrelated work remains runnable', (t) =>
  scenario.run(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
