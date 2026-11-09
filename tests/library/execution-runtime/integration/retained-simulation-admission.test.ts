import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import type { TestContext } from 'node:test';
import { HostClient } from '../../../../dist/library/execution-runtime/host-client.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { PublicationFixture } from '../support/publication-fixture.js';

/** Uses the production host's compact status projection across a controlled private IPC transport. */
class RetainedAdmissionScenario {
  readonly fixture;

  readonly context;

  readonly host;

  readonly client;

  readonly requests: Array<Record<string, any>> = [];

  /** Captures real package authority without dispatching model turns or managed operations. */
  constructor(t: TestContext) {
    const prepared = new PublicationFixture(t);
    this.fixture = prepared.general.fixture;
    this.context = prepared.context;
    this.host = prepared.host;
    this.client = new HostClient(this.fixture.repo, this.fixture.state);
    t.mock.method(globalThis, 'fetch', () => {
      throw new Error('Retained admission must not fetch a new upstream revision');
    });
  }

  /** Serves actual status and task admission, substituting only socket transport and host capabilities. */
  async listen(t: TestContext): Promise<void> {
    const server = createServer((socket) => {
      let message = '';
      socket.on('data', (chunk) => {
        message += String(chunk);
        if (!message.includes('\n')) return;
        const request = JSON.parse(message.split('\n')[0]!);
        this.requests.push(request);
        socket.end(JSON.stringify({ value: this.dispatch(request) }) + '\n');
      });
    });
    await new Promise<void>((resolve) => server.listen(this.client.socket, resolve));
    t.after(() => server.close());
  }

  /** Rejects unexpected controls instead of silently accepting authority recapture or host replacement. */
  private dispatch(request: Record<string, any>): unknown {
    if (request.action === 'identity')
      return { ...this.context, hostCapabilities: ['simulation', 'staging-snapshot'] };
    if (request.action === 'status') return this.host.status();
    assert.equal(request.action, 'submit');
    return this.host.submit(request.prompt, request.simulate, request.expectedEnvironmentId);
  }

  /** Requires same-environment admission even though the report intentionally omits package authority. */
  async run(t: TestContext): Promise<void> {
    this.host.control('start', true);
    const started = this.host.status().workday!;
    assert.equal('packageId' in started.data, false);
    await this.listen(t);
    await this.client.ensureRun('submit', true, new AbortController().signal);
    const task = await this.client.request({ action: 'submit', simulate: true, prompt: 'Improve' });
    assert.deepEqual(task.environment, started.environment);
    assert.equal(task.data.authorityBase, this.context.base);
    assert.equal(this.requests.at(-1)!.expectedEnvironmentId, started.environment!.id);
    assert.equal(
      this.requests.some((request) => request.action === 'retire'),
      false,
    );
  }
}

test('retained simulation admission uses host authority rather than the compact run report', async (t) =>
  new RetainedAdmissionScenario(t).run(t));

registerSuite({
  component: 'execution-runtime',
  level: 'integration',
  tags: ['deterministic', 'native-host', 'lifecycle-effects'],
});
