import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ExecutionContext } from '../../../../dist/library/architecture/execution-context.js';
import { ProjectHost } from '../../../../dist/library/execution-runtime/project-host.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Checks durable inbox wakeups against actual idle stewardship without overriding user controls. */
class IdleWakeupScenarios {
  /** A semantic refusal leaves its failed activation visible and another owner can service inbox work. */
  async wrongOwner(t: TestContext): Promise<void> {
    const f = new GeneralFixture(t).fixture;
    writeFileSync(f.calls + '.wrong-owner', 'a reports about b');
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.store.close());
    host.control('start');
    const run = host.store.runs()[0]!;
    for (let turn = 0; turn < 5; turn++) await host.tick();
    const current = host.store.run(run.id);
    assert.equal(current.status, 'idle');
    const reviews = current.data.stewardshipReviews as Record<string, any>;
    assert.equal(reviews.a.status, 'rejected');
    assert.match(reviews.a.error, /captured owner/);
    const record = JSON.parse(
      readFileSync(join(f.state, 'runs', reviews.a.recordId, 'report.json'), 'utf8'),
    );
    assert.equal(record.status, 'failed');
    assert.equal(reviews.b.status, 'ready');
    const recipient = this.request(host, run.id);
    await host.tick();
    assert.ok(host.store.assignment(recipient.id).data.recordId);
  }

  /** An unchanged pass remains quiet until new inbox work makes an eligible owner runnable. */
  async incoming(t: TestContext): Promise<void> {
    const { host, run, f } = await this.fixture(t);
    const calls = readFileSync(f.calls, 'utf8');
    await host.tick();
    assert.equal(readFileSync(f.calls, 'utf8'), calls);
    const recipient = this.request(host, run.id);
    assert.equal(host.store.run(run.id).status, 'running');
    await host.tick();
    assert.ok(host.store.assignment(recipient.id).data.recordId);
    assert.notEqual(readFileSync(f.calls, 'utf8'), calls);
  }

  /** Incoming requests cannot undo a manual pause or stop. */
  async controlled(t: TestContext, action: string): Promise<void> {
    const { host, run, f } = await this.fixture(t);
    host.control(action);
    const calls = readFileSync(f.calls, 'utf8');
    const recipient = this.request(host, run.id);
    await host.tick();
    assert.equal(host.store.run(run.id).status, action === 'pause' ? 'paused' : 'stopped');
    assert.equal(host.store.assignment(recipient.id).data.recordId, undefined);
    assert.equal(readFileSync(f.calls, 'utf8'), calls);
  }

  /** Persists an owner-scoped external inbox request through the public coordination boundary. */
  private request(host: ProjectHost, runId: string) {
    const sender = host.store.enqueue(runId, 'a', 'Incoming owner request');
    host.store.updateAssignment(sender.id, 'ready', { proposal: { kind: 'research' } });
    return host.store.request(sender.id, {
      key: 'new-inbox-work',
      owner: 'c',
      objective: 'Research newly available evidence',
      acceptance: ['Evidence-backed result'],
      kind: 'research',
    });
  }

  /** Lets each eligible steward complete its no-work pass through production policy wiring. */
  private async fixture(t: TestContext) {
    const f = new GeneralFixture(t).fixture;
    const host = new ProjectHost(f.state, new ExecutionContext().resolve(f.repo));
    t.after(() => host.store.close());
    host.control('start');
    const run = host.store.runs()[0]!;
    for (let observation = 0; observation < 5; observation++) {
      await host.tick();
      if (host.store.run(run.id).status === 'idle') break;
    }
    assert.equal(host.store.run(run.id).status, 'idle');
    return { host, run, f };
  }
}

const scenarios = new IdleWakeupScenarios();

test('a wrong-owner decision preserves failed evidence and unrelated workday dispatch', (t) =>
  scenarios.wrongOwner(t));

test('idle workdays wake on persisted inbox requests and otherwise remain quiet', (t) =>
  scenarios.incoming(t));

for (const action of ['pause', 'stop'])
  test('inbox wakeups preserve an explicit ' + action, (t) => scenarios.controlled(t, action));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
