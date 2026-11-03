import assert from 'node:assert/strict';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { executionIdentity } from '../../../../dist/library/architecture/execution-context.js';
import { ExecutionStore } from '../../../../dist/library/coordination-store/execution-store.js';
import type {
  RunMode,
  RunStatus,
} from '../../../../dist/library/coordination-store/execution-types.js';
import { HostClient } from '../../../../dist/library/execution-runtime/host-client.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Exercises retirement against the production listener and its durable execution state. */
class RetirementAdmissionScenarios {
  /** Opens an isolated host with cleanup registered before any assertion can fail. */
  private async open(
    t: TestContext,
    retained: { mode: RunMode; status: RunStatus; partial?: boolean }[] = [],
  ) {
    const fixture = new GeneralFixture(t);
    const client = new HostClient(fixture.fixture.repo, fixture.fixture.state);
    const store = new ExecutionStore(join(client.directory, 'execution.sqlite'));
    t.after(() => store.close());
    for (const entry of retained) {
      const run = store.createRun(entry.mode, ['a', 'b', 'c'], 'Retained work');
      if (entry.partial) store.enqueue(run.id, 'a', 'Retain unfinished evidence');
      store.updateRun(run.id, entry.status, {
        executionIdentity: executionIdentity(client.context),
      });
    }
    await client.ensure('status');
    fixture.captureHost();
    return { client, store };
  }

  /** Rejected writes cannot create runs after acknowledgment; reads and repeat retirement still work. */
  async admission(t: TestContext): Promise<void> {
    const { client, store } = await this.open(t);
    assert.equal(await client.request({ action: 'retire' }), true);
    const mutations = [
      { action: 'submit', prompt: 'Retirement probe' },
      { action: 'start' },
      { action: 'resume' },
      { action: 'task-control', control: 'resume', id: 'missing' },
      { action: 'workday-control', control: 'resume', id: 'missing' },
      { action: 'answer', id: 'missing', answer: 'Do not admit' },
    ];
    await Promise.all([
      ...mutations.map((request) =>
        assert.rejects(client.request(request), /Execution host is retiring/),
      ),
      client.request({ action: 'identity' }).then((value) => assert.ok(value.key)),
      client.request({ action: 'status' }).then((value) => assert.equal(value.active, null)),
      client.request({ action: 'retire' }).then((value) => assert.equal(value, true)),
    ]);
    assert.deepEqual(store.runs(), []);
  }

  /** Protected runs survive refused retirement without changing their state or evidence. */
  async protected(t: TestContext, mode: RunMode, status: RunStatus): Promise<void> {
    const { client, store } = await this.open(t, [{ mode, status }]);
    const before = store.runs();
    await assert.rejects(
      client.request({ action: 'retire' }),
      /Active execution host cannot retire/,
    );
    assert.deepEqual(store.runs(), before);
    assert.ok((await client.request({ action: 'identity' })).key);
    const result = await client.request({
      action: `${mode}-control`,
      control: 'stop',
      id: before[0]!.id,
    });
    assert.equal(result.run.status, mode === 'task' ? 'cancelled' : 'stopped');
  }

  /** Historical incomplete assignments attached to terminal tasks are retained without blocking exit. */
  async terminal(t: TestContext): Promise<void> {
    const statuses = ['completed', 'cancelled', 'failed', 'stopped'] as const;
    const { client, store } = await this.open(
      t,
      statuses.map((status) => ({ mode: 'task', status, partial: true })),
    );
    const before = store.runs();
    assert.equal(await client.request({ action: 'retire' }), true);
    const view = await client.request({ action: 'task-status', id: before[0]!.id });
    assert.equal(view.run.status, 'completed');
    assert.deepEqual(store.runs(), before);
    for (const run of before) assert.equal(store.assignments(run.id).length, 1);
  }
}

const scenarios = new RetirementAdmissionScenarios();

test('retirement closes mutation admission before releasing the host', (t) =>
  scenarios.admission(t));

for (const status of ['paused', 'needs_input', 'needs_attention', 'interrupted'] as const)
  test(`retirement preserves a ${status} task`, (t) => scenarios.protected(t, 'task', status));

for (const status of ['idle', 'paused'] as const)
  test(`retirement preserves a ${status} workday`, (t) =>
    scenarios.protected(t, 'workday', status));

test('terminal tasks retain partial evidence after retirement', (t) => scenarios.terminal(t));

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic', 'retirement'],
});
