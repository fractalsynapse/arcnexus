import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import type { TestContext } from 'node:test';
import { HostClient } from '../../../../dist/library/execution-runtime/host-client.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { GeneralFixture, nativeHostTest as test } from '../../testing/support/general-fixture.js';

/** Exercises the actual host client against delayed and disconnected private control endpoints. */
class ControlWaitScenarios {
  /** A checkpoint can delay a control response without causing submission replay or uncertain failure. */
  async delayed(t: TestContext): Promise<void> {
    let submissions = 0;
    let timer: NodeJS.Timeout | undefined;
    t.after(() => clearTimeout(timer));
    const client = await this.endpoint(t, (socket) => {
      submissions++;
      timer = setTimeout(
        () => socket.end(JSON.stringify({ value: { id: 'retained-task' } }) + '\n'),
        6000,
      );
    });
    assert.deepEqual(await client.request({ action: 'submit', prompt: 'bounded goal' }), {
      id: 'retained-task',
    });
    assert.equal(submissions, 1);
  }

  /** A lost host response fails explicitly instead of leaving the attached caller indefinitely waiting. */
  async disconnected(t: TestContext): Promise<void> {
    const client = await this.endpoint(t, (socket) => socket.end());
    await assert.rejects(
      client.request({ action: 'task-status', id: 'task' }),
      /disconnected before response/,
    );
  }

  /** Creates a private fixture endpoint and releases every socket even when an assertion fails. */
  private async endpoint(t: TestContext, respond: (socket: Socket) => void): Promise<HostClient> {
    const f = new GeneralFixture(t).fixture;
    const client = new HostClient(f.repo, f.state);
    const sockets = new Set<Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on('error', () => {});
      socket.once('data', () => respond(socket));
    });
    t.after(() => {
      for (const socket of sockets) socket.destroy();
      return new Promise<void>((done) => server.close(() => done()));
    });
    await new Promise<void>((done) => server.listen(client.socket, done));
    return client;
  }
}

const scenarios = new ControlWaitScenarios();

test('accepted control waits through a slow checkpoint without replay', { timeout: 15000 }, (t) =>
  scenarios.delayed(t),
);

test('control reports a disconnected host before its response', { timeout: 5000 }, (t) =>
  scenarios.disconnected(t),
);

registerSuite({
  component: 'execution-runtime',
  level: 'acceptance',
  tags: ['native-host', 'deterministic'],
});
