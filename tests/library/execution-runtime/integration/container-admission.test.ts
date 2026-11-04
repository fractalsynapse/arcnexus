import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { ContainerLifetime } from '../../../../dist/library/execution-runtime/container-lifetime.js';
import { nativeHostTest } from '../../testing/support/general-fixture.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Checks deployment admission and foreign host refusal without starting engineering or sending real signals. */
class ContainerAdmissionScenarios {
  /** Refuses a live endpoint claiming another storage root and leaves admission closed until replacement. */
  async foreign(t: TestContext): Promise<void> {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-container-admission-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const key = randomBytes(12).toString('hex');
    mkdirSync(join(root, 'projects', key), { recursive: true });
    const lifetime = new ContainerLifetime(root);
    const socket = join('/tmp', `arcnexus-${process.getuid?.() ?? 'user'}`, key + '.sock');
    mkdirSync(join(socket, '..'), { recursive: true });
    await this.foreignEndpoint(socket, root, t);
    await assert.rejects(lifetime.shutdown(), (error: AggregateError) => {
      assert.match(String(error.errors[0]), /matching live deployment identity/);
      return true;
    });
    assert.throws(() => ContainerLifetime.assertOpen(root), /Container is shutting down/);
    rmSync(join(root, 'projects', key), { recursive: true });
    const replacement = new ContainerLifetime(root);
    ContainerLifetime.assertOpen(root);
    await replacement.shutdown();
  }

  /** Owns the foreign IPC fixture and reports bind failures through the test rather than an uncaught event. */
  private async foreignEndpoint(socket: string, root: string, t: TestContext): Promise<void> {
    const server = createServer((connection) => {
      connection.once('data', () =>
        connection.end(
          JSON.stringify({
            value: { key, runtime: { root: root + '-foreign', pid: 99999999, start: '1' } },
          }) + '\n',
        ),
      );
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(socket, resolve);
    });
    t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  }

  /** Excludes a second lifetime owner and treats repeated empty-volume shutdown as the same drain. */
  async exclusive(t: TestContext): Promise<void> {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-container-owner-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const lifetime = new ContainerLifetime(root);
    assert.throws(() => new ContainerLifetime(root), /already owns/);
    const first = lifetime.shutdown();
    assert.equal(lifetime.shutdown(), first);
    await first;
    assert.throws(() => ContainerLifetime.assertOpen(root), /Container is shutting down/);
  }
}

const scenarios = new ContainerAdmissionScenarios();

nativeHostTest(
  'container shutdown refuses a foreign answering host and retains closed admission',
  (t) => scenarios.foreign(t),
);

test('container lifetime has one owner and idempotent shutdown without dispatch', (t) =>
  scenarios.exclusive(t));

registerSuite({
  component: 'execution-runtime',
  level: 'integration',
  tags: ['deterministic', 'native-host', 'host-lifecycle'],
});
