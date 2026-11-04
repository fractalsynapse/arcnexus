import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import type { TestContext } from 'node:test';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { HostClient } from '../../../../dist/library/execution-runtime/host-client.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { workflowFixture } from '../../testing/support/workflow-fixture.js';

/** Provides controlled IPC capability responses without starting model or engineering execution. */
class AdmissionFixture {
  readonly requests: Record<string, unknown>[] = [];

  readonly client: HostClient;

  /** Creates a repository-scoped client without resolving executable architecture or launching a host. */
  constructor(t: TestContext) {
    const fixture = workflowFixture(t, 'success');
    this.client = new HostClient(fixture.repo, fixture.state);
  }

  /** Records exactly which requests reach the older or current host protocol boundary. */
  async listen(t: TestContext, capabilities: string[]): Promise<void> {
    const server = createServer((socket) => {
      let message = '';
      socket.on('data', (data) => {
        message += data.toString();
        if (!message.includes('\n')) return;
        const request = JSON.parse(message.split('\n')[0]!);
        this.requests.push(request);
        const value =
          request.action === 'identity'
            ? { hostCapabilities: capabilities }
            : { accepted: true, simulation: request.simulate };
        socket.end(JSON.stringify({ value }) + '\n');
      });
    });
    await new Promise<void>((resolve) => server.listen(this.client.socket, resolve));
    t.after(() => server.close());
  }
}

test('simulation submission never reaches a host that cannot enforce its mode', async (t) => {
  const fixture = new AdmissionFixture(t);
  await fixture.listen(t, ['task-control']);
  await assert.rejects(
    () => fixture.client.request({ action: 'submit', simulate: true, prompt: 'Simulate' }),
    /does not support simulation/,
  );
  assert.deepEqual(
    fixture.requests.map((request) => request.action),
    ['identity'],
  );
});

test('qualified host receives the explicit immutable simulation selection', async (t) => {
  const fixture = new AdmissionFixture(t);
  await fixture.listen(t, ['task-control', 'simulation']);
  const result = await fixture.client.request({
    action: 'submit',
    simulate: true,
    prompt: 'Simulate',
  });
  assert.deepEqual(result, { accepted: true, simulation: true });
  assert.deepEqual(
    fixture.requests.map((request) => request.action),
    ['identity', 'submit'],
  );
});

registerSuite({
  component: 'execution-runtime',
  level: 'integration',
  tags: ['deterministic', 'lifecycle-effects', 'native-host'],
});
