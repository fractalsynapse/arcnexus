import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { GitHubDelivery } from '../../../../dist/library/operations/github-delivery.js';
import { execute, git } from '../../../../dist/library/operations/process.js';
import type { DeliveryRecord } from '../../../../dist/library/coordination-store/delivery-types.js';
import type { ExternalEffect } from '../../../../dist/library/coordination-store/lifecycle-types.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Exercises actual Git transfer while substituting only the external GitHub HTTP and push destinations. */
class GitHubDeliveryFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'arcnexus-github-delivery-'));

  readonly source = join(this.root, 'source');

  readonly remote = join(this.root, 'remote.git');

  readonly id = 'd'.repeat(64);

  readonly calls: Array<{ args: string[]; credential: boolean }> = [];

  readonly signal = new AbortController().signal;

  readonly delivery: DeliveryRecord;

  readonly head: string;

  readonly provider: GitHubDelivery;

  readonly effect: ExternalEffect = {
    id: 'push',
    environmentId: 'live',
    runId: 'run',
    operation: 'delivery.push',
    target: 'example/project',
    definitionDigest: 'grant',
    inputDigest: 'input',
    status: 'uncertain',
    attempt: 1,
    input: { deliveryId: this.id },
  };

  /** Creates verified-shape fixture objects without any reachable real upstream or personal credentials. */
  constructor(t: TestContext) {
    t.after(() => rmSync(this.root, { recursive: true, force: true }));
    mkdirSync(this.source);
    git(this.source, 'init', '-q');
    git(this.source, 'config', 'user.name', 'Fixture');
    git(this.source, 'config', 'user.email', 'fixture@example.invalid');
    const base = this.commit('before', 'baseline');
    this.head = this.commit('after', 'ArcNexus verified delivery ' + this.id);
    git(this.source, 'init', '--bare', this.remote);
    this.delivery = this.record(base);
    this.provider = new GitHubDelivery(
      this.delivery,
      this.source,
      this.head,
      join(this.root, 'evidence'),
      async () => 'test-secret',
      async () => this.reference(),
      (...args) => this.command(...args),
    );
  }

  /** Produces real local commits so transport must satisfy the same tree and parent checks as production. */
  private commit(text: string, message: string): string {
    writeFileSync(join(this.source, 'source.txt'), text);
    git(this.source, 'add', '.');
    git(this.source, 'commit', '-qm', message);
    return git(this.source, 'rev-parse', 'HEAD').trim();
  }

  /** Captures deterministic fixture authority separately from actual provider mutation observations. */
  private record(base: string): DeliveryRecord {
    return {
      id: this.id,
      projectId: 'project',
      packageId: 'package',
      runId: 'run',
      assignmentIds: ['owner'],
      environment: { id: 'live', mode: 'live' },
      authorityDigest: 'authority',
      base,
      candidate: this.head,
      verification: { references: ['fixture-review'], digest: 'verified' },
      target: { repository: 'example/project', branch: 'staging' },
      version: 1,
      createdAt: '2026-11-04T00:00:00Z',
      engineering: 'verified',
      receipts: { commit: 'effect-commit' },
    };
  }

  /** Reflects actual local remote refs instead of returning unconditional publication success. */
  private reference(): Response {
    const sha = git(
      this.remote,
      'for-each-ref',
      '--format=%(objectname)',
      'refs/heads/arcnexus/' + this.id,
    ).trim();
    return new Response(JSON.stringify(sha ? { object: { type: 'commit', sha } } : {}), {
      status: sha ? 200 : 404,
    });
  }

  /** Keeps real Git preparation and push while redirecting the external transport at the declared test boundary. */
  private async command(...[command, cwd, log, signal, options]: Parameters<typeof execute>) {
    assert.equal(options?.processScope, true);
    this.calls.push({ args: command.args, credential: !!options?.env?.GIT_CONFIG_VALUE_0 });
    assert.equal(JSON.stringify(command).includes('test-secret'), false);
    const env: NodeJS.ProcessEnv = { ...options!.env, GIT_ALLOW_PROTOCOL: 'file' };
    delete env.GIT_CONFIG_COUNT;
    delete env.GIT_CONFIG_KEY_0;
    delete env.GIT_CONFIG_VALUE_0;
    const args = command.args.map((arg) =>
      arg === 'https://github.com/example/project.git' ? this.remote : arg,
    );
    return execute({ ...command, args }, cwd, log, signal, {
      ...options,
      env,
      processScope: false,
    });
  }
}

test('GitHub delivery uses an isolated Git transport and reuses the exact published head', async (t) => {
  const f = new GitHubDeliveryFixture(t);
  const result = await f.provider.apply(f.effect, f.signal);
  assert.equal(result.head, f.head);
  assert.equal(result.simulation, false);
  assert.equal(f.calls.length, 3);
  assert.deepEqual(
    f.calls.map((call) => call.credential),
    [false, false, true],
  );
  const args = f.calls.at(-1)!.args;
  assert.equal(
    args.some((arg) => arg.startsWith('--force')),
    false,
  );
  assert.equal(args.at(-1), f.head + ':refs/heads/arcnexus/' + f.id);
  assert.equal(git(f.source, 'status', '--porcelain').trim(), '');
  await f.provider.apply(f.effect, f.signal);
  assert.equal(f.calls.length, 3);
  assert.equal((await f.provider.inspect(f.effect, f.signal)).status, 'completed');
});

test('GitHub delivery blocks conflicts and does not replay missing uncertain refs', async (t) => {
  const f = new GitHubDeliveryFixture(t);
  assert.equal((await f.provider.inspect(f.effect, f.signal)).status, 'unknown');
  await f.provider.apply(f.effect, f.signal);
  git(f.remote, 'update-ref', 'refs/heads/arcnexus/' + f.id, f.delivery.base);
  assert.equal((await f.provider.inspect(f.effect, f.signal)).status, 'rejected');
  await assert.rejects(f.provider.apply(f.effect, f.signal), /conflicts/);
  await assert.rejects(
    f.provider.apply({ ...f.effect, environmentId: 'simulation' }, f.signal),
    /authority/,
  );
  assert.equal(f.calls.length, 3);
});

test('GitHub delivery rejects unverified commit attribution before credential access', (t) => {
  const f = new GitHubDeliveryFixture(t);
  const credential = async () => {
    throw new Error('Credential must not be read');
  };
  assert.throws(
    () =>
      new GitHubDelivery(
        f.delivery,
        f.source,
        f.delivery.base,
        join(f.root, 'evidence'),
        credential,
      ),
    /tree and attribution/,
  );
  assert.throws(
    () =>
      new GitHubDelivery(
        { ...f.delivery, environment: { id: 'sim', mode: 'simulation' } },
        f.source,
        f.head,
        join(f.root, 'evidence'),
        credential,
      ),
    /verified live delivery/,
  );
});

registerSuite({
  component: 'operations',
  level: 'integration',
  tags: ['deterministic', 'lifecycle-effects'],
});
