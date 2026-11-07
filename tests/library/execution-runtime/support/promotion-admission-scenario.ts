import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type { ProjectExecution } from '../../../../dist/library/architecture/execution-context.js';
import { ExecutionControls } from '../../../../dist/library/execution-runtime/execution-controls.js';
import { HostClient } from '../../../../dist/library/execution-runtime/host-client.js';
import { HostRuntime } from '../../../../dist/library/execution-runtime/host-runtime.js';
import { PromotionFixture } from './promotion-fixture.js';

/** Exercises production promotion and admission with controlled provider and process-launch boundaries. */
export class PromotionAdmissionScenario {
  private readonly fixture: PromotionFixture;

  private readonly client: HostClient;

  private readonly server: Server;

  private identity?: ProjectExecution;

  private readonly actions: string[] = [];

  /** Retains real delivery proof and serves the identity serialized for the newly launched host. */
  constructor(private readonly t: TestContext) {
    this.fixture = new PromotionFixture(t);
    const f = this.fixture.general.fixture;
    this.client = new HostClient(f.repo, f.state);
    this.server = createServer((socket) => {
      let message = '';
      socket.on('data', (chunk) => {
        message += String(chunk);
        if (!message.includes('\n')) return;
        const request = JSON.parse(message.split('\n')[0]!);
        try {
          socket.end(JSON.stringify({ value: this.dispatch(request) }) + '\n');
        } catch (error) {
          socket.end(JSON.stringify({ error: (error as Error).message }) + '\n');
        }
      });
    });
    t.after(() => this.server.close());
    this.captureLaunch();
    this.observeStaging();
  }

  /** Replaces process creation only; host acquisition reads and serializes its production context. */
  private captureLaunch(): void {
    const directory = this.client.directory;
    writeFileSync(join(directory, 'host.json'), JSON.stringify({ contextFile: 'source.json' }));
    writeFileSync(join(directory, 'source.json'), JSON.stringify(this.fixture.context));
    this.t.mock.method(
      HostRuntime.prototype,
      'launch',
      (_root: string, path: string, socket: string) => {
        this.identity = JSON.parse(readFileSync(path, 'utf8'));
        this.server.listen(socket);
        return undefined as any;
      },
    );
  }

  /** Supplies one stable provider staging revision while refusing unrelated upstream effects. */
  private observeStaging(): void {
    this.fixture.credential(this.t);
    this.t.mock.method(globalThis, 'fetch', async (url: string | URL, options: RequestInit) => {
      assert.equal(
        String(url),
        'https://api.github.com/repos/example/promotion-fixture/git/ref/heads/staging',
      );
      assert.equal(options.method, 'GET');
      return Response.json({
        ref: 'refs/heads/staging',
        object: { type: 'commit', sha: this.fixture.context.base },
      });
    });
  }

  /** Routes controls into the actual host and exposes any retirement attempt as a deterministic error. */
  private dispatch(request: Record<string, any>): unknown {
    this.actions.push(request.action);
    if (request.action === 'identity')
      return { ...this.identity, hostCapabilities: ['delivery-promote', 'staging-snapshot'] };
    if (request.action === 'status') return this.fixture.host.status();
    if (request.action === 'retire') throw new Error('Controlled incompatible-context retirement');
    if (request.action === 'delivery-promote')
      return this.fixture.host.promote(request.id, request.expectedRevision);
    assert.equal(request.action, 'submit');
    return this.fixture.host.submit(
      request.prompt,
      request.simulate,
      request.expectedEnvironmentId,
    );
  }

  /** Promotion followed by an ordinary live task reuses the exact staging context and original proof. */
  async compatible(): Promise<void> {
    const f = this.fixture;
    const original = JSON.stringify(f.deliveries.get(f.delivery.id));
    const queued = await new ExecutionControls(f.general.fixture.state).promote(f.delivery.id);
    assert.equal(f.host.store.run(queued.runId).environment?.mode, 'live');
    await assert.doesNotReject(
      this.client.ensureRun('submit', false, new AbortController().signal),
      'compatible ordinary admission must reuse the promotion host',
    );
    assert.deepEqual(this.identity?.observedStaging, f.delivery.target);
    const task = await this.client.request({ action: 'submit', prompt: 'Ordinary follow-up' });
    assert.equal(task.environment.mode, 'live');
    assert.equal(task.data.authorityBase, f.context.base);
    assert.equal(this.actions.includes('retire'), false);
    assert.equal(JSON.stringify(f.deliveries.get(f.delivery.id)), original);
    assert.equal(f.host.store.run(f.source.id).environment?.mode, 'simulation');
  }

  /** Different destination or authority retains active-work refusal and inactive-host retirement. */
  async incompatible(change: 'destination' | 'authority'): Promise<void> {
    const f = this.fixture;
    const queued = await new ExecutionControls(f.general.fixture.state).promote(f.delivery.id);
    assert.ok(this.identity);
    if (change === 'destination')
      this.identity.observedStaging = { ...f.delivery.target, branch: 'another-staging' };
    else this.identity.base = '0'.repeat(40);
    f.host.store.updateRun(queued.runId, 'running');
    await assert.rejects(
      this.client.ensureRun('submit', false, new AbortController().signal),
      /Captured source\/package\/bindings changed/,
    );
    assert.equal(this.actions.includes('retire'), false);
    f.host.store.updateRun(queued.runId, 'completed');
    await assert.rejects(
      this.client.ensureRun('submit', false, new AbortController().signal),
      /Controlled incompatible-context retirement/,
    );
    assert.equal(this.actions.filter((action) => action === 'retire').length, 1);
  }
}
