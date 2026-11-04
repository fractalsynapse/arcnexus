import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import {
  LivePublication,
  type CapturedPublicationPolicy,
} from '../../../../dist/library/publisher/publisher.js';
import { execute, git } from '../../../../dist/library/operations/process.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';
import { nativeHostTest as test } from '../../testing/support/general-fixture.js';
import { GitDeliveryFixture } from '../../testing/support/delivery-fixture.js';

/** Uses actual Git and durable stores with a controlled external provider at the HTTP/transport boundary. */
class LivePublicationFixture {
  readonly git: GitDeliveryFixture;

  readonly id = 'b'.repeat(64);

  readonly publication: LivePublication;

  readonly requests: string[] = [];

  checkStatus: 'passed' | 'failed' = 'passed';

  checks = 0;

  afterCheck?: () => void;

  integrationFault?: 'race' | 'lost-receipt';

  ci = 'PENDING';

  pull: any;

  readonly policy: CapturedPublicationPolicy = {
    owner: 'publisher',
    operation: {
      schemaVersion: 4,
      id: 'publish',
      kind: 'upstream',
      action: 'delivery.publish',
      purpose: 'Controlled publication',
      repository: 'repo',
      cwd: '.',
      category: 'collaboration',
      activities: ['release'],
      generatedDirectories: [],
      artifacts: [],
      probes: [],
      targetBranch: 'staging',
      definitionDigest: 'policy',
    },
  };

  /** Keeps test credentials and remote repository entirely local while exercising production orchestration. */
  constructor(t: TestContext) {
    this.git = new GitDeliveryFixture(t);
    const delivery = this.capture();
    this.publication = new LivePublication(
      {
        root: this.git.root,
        repositoryId: 'repo',
        source: this.git.repository.source,
        effects: this.git.effects,
        deliveries: this.git.store,
        policy: this.policy,
        credential: async () => 'controlled-secret',
        checks: async (head, _signal, independent) => this.check(head, independent),
        transport: async (url, options) => this.request(String(url), options!),
        runner: (...args) => this.command(...args),
      },
      delivery,
    );
  }

  /** Checks real delivered bytes while explicitly substituting independent model input for deterministic acceptance. */
  private check(head: string, independent: boolean) {
    assert.equal(independent, true);
    assert.equal(
      git(this.git.repository.source, 'show', head + ':source.txt'),
      'reviewed candidate',
    );
    this.checks++;
    this.afterCheck?.();
    return { status: this.checkStatus, evidence: ['controlled-review'], artifacts: [] };
  }

  /** Registers a separate live identity without changing the fixture's retained simulation evidence. */
  private capture() {
    const original = this.git.store.get(this.git.id);
    const delivery = this.git.store.capture({
      ...original,
      id: this.id,
      environment: { id: 'live', mode: 'live' },
      target: { repository: 'example/project', branch: 'staging' },
    });
    this.git.effects.register({
      id: 'live',
      mode: 'live',
      repositoryId: 'repo',
      providerId: 'live-provider',
      authorityDigest: 'authority',
    });
    return delivery;
  }

  /** Redirects only the external push destination; actual supervised Git commands still execute. */
  private async command(...[command, cwd, log, signal, options]: Parameters<typeof execute>) {
    const env: NodeJS.ProcessEnv = { ...options!.env, GIT_ALLOW_PROTOCOL: 'file' };
    delete env.GIT_CONFIG_COUNT;
    delete env.GIT_CONFIG_KEY_0;
    delete env.GIT_CONFIG_VALUE_0;
    const args = command.args.map((arg) =>
      arg === 'https://github.com/example/project.git' ? this.git.repository.origin : arg,
    );
    const integration = args.some((arg) => arg.startsWith('--force-with-lease='));
    if (integration && this.integrationFault === 'race')
      git(this.git.repository.origin, 'update-ref', 'refs/heads/staging', this.head());
    const result = await execute({ ...command, args }, cwd, log, signal, { ...options, env });
    if (integration && this.integrationFault === 'lost-receipt')
      throw new Error('Controlled receipt loss after actual integration');
    return result;
  }

  /** Observes the actual pushed ref instead of inventing a successful Git delivery. */
  private head(ref = 'arcnexus/' + this.id): string {
    return git(
      this.git.repository.origin,
      'for-each-ref',
      '--format=%(objectname)',
      'refs/heads/' + ref,
    ).trim();
  }

  /** Implements only the provider requests permitted by this bounded publication workflow. */
  private request(url: string, options: RequestInit): Response {
    this.requests.push(options.method + ' ' + url);
    if (url.endsWith('/graphql')) return Response.json(this.gates());
    const path = new URL(url).pathname.replace('/repos/example/project', '');
    if (!path) return Response.json({ default_branch: 'main' });
    if (path.startsWith('/git/ref/')) {
      const head = this.head(decodeURIComponent(path.slice('/git/ref/heads/'.length)));
      return head
        ? Response.json({ object: { type: 'commit', sha: head } })
        : new Response('{}', { status: 404 });
    }
    if (path === '/branches/staging') return Response.json({ name: 'staging' });
    if (path === '/pulls' && options.method === 'POST') {
      const body = JSON.parse(String(options.body));
      const repo = { full_name: 'example/project' };
      this.pull = {
        number: 7,
        html_url: 'https://github.com/example/project/pull/7',
        body: body.body,
        head: { sha: this.head(), ref: 'arcnexus/' + this.id, repo },
        base: { ref: 'staging', repo },
      };
      return Response.json(this.pull);
    }
    if (path === '/pulls') return Response.json(this.pull ? [this.pull] : []);
    throw new Error('Unexpected provider mutation or observation: ' + url);
  }

  /** Ties every changing provider check observation to the actual published commit. */
  private checkedCommit() {
    return { oid: this.head(), statusCheckRollup: { state: this.ci, contexts: { totalCount: 1 } } };
  }

  /** Lets pending CI change independently of immutable publication receipts. */
  private gates() {
    return {
      data: {
        repository: {
          nameWithOwner: 'example/project',
          defaultBranchRef: { name: 'main' },
          pullRequest: {
            number: 7,
            url: 'https://github.com/example/project/pull/7',
            headRefOid: this.head(),
            headRefName: 'arcnexus/' + this.id,
            headRepository: { nameWithOwner: 'example/project' },
            baseRefName: 'staging',
            baseRefOid: this.head('staging'),
            state: 'OPEN',
            isDraft: false,
            mergeable: 'MERGEABLE',
            mergeStateStatus: 'CLEAN',
            reviewDecision: 'APPROVED',
            commits: { nodes: [{ commit: this.checkedCommit() }] },
          },
        },
      },
    };
  }
}

test('live publication retains PR and refreshes CI without repeating verified effects', async (t) => {
  const f = new LivePublicationFixture(t);
  await assert.rejects(f.publication.publish(f.git.signal), /CI evidence/);
  const pending = f.git.store.get(f.id);
  assert.equal(pending.integration, 'pending');
  assert.equal(pending.delivery, 'pushed');
  f.ci = 'SUCCESS';
  await assert.rejects(f.publication.publish(f.git.signal), /requires approval/);
  f.git.store.approve(f.id, f.git.store.get(f.id).version, pending.candidate);
  const merged = await f.publication.publish(f.git.signal);
  assert.equal(merged.integration, 'merged');
  assert.deepEqual(await f.publication.publish(f.git.signal), merged);
  assert.equal(f.checks, 2);
  assert.equal(
    f.requests.filter((entry) => entry.endsWith('/pulls') && entry.startsWith('POST')).length,
    1,
  );
  assert.equal(f.git.effects.effects().length, 5);
  const target = git(f.git.repository.origin, 'rev-parse', 'staging').trim();
  assert.notEqual(target, pending.base);
  assert.equal(git(f.git.repository.origin, 'show', 'staging:source.txt'), 'reviewed candidate');
  assert.equal(git(f.git.repository.origin, 'rev-parse', 'staging^1').trim(), pending.base);
  assert.equal(f.git.store.get(f.id).publication, 'not_requested');
});

test('failed live verification prevents branch and PR publication', async (t) => {
  const f = new LivePublicationFixture(t);
  f.checkStatus = 'failed';
  await assert.rejects(f.publication.publish(f.git.signal), /checks failed/);
  assert.equal(f.git.store.get(f.id).delivery, 'committed');
  assert.deepEqual(f.requests, []);
  assert.equal(f.git.effects.effects().length, 2);
});

test('changed integration target retains uncertainty and cannot be silently retried', async (t) => {
  const f = new LivePublicationFixture(t);
  f.ci = 'SUCCESS';
  const current = f.git.store.get(f.id);
  f.git.store.approve(f.id, current.version, current.candidate);
  f.afterCheck = () => {
    if (f.checks !== 2) return;
    const origin = f.git.repository.origin;
    const head = git(origin, 'rev-parse', 'refs/heads/arcnexus/' + f.id).trim();
    git(origin, 'update-ref', 'refs/heads/staging', head, current.base);
  };
  await assert.rejects(f.publication.publish(f.git.signal), /changed during verification/);
  const merge = f.git.effects
    .effects()
    .find((effect) => effect.operation === 'pull-request.merge')!;
  assert.equal(merge.status, 'uncertain');
  await assert.rejects(f.publication.publish(f.git.signal), /requires reconciliation/);
  assert.equal(f.git.store.get(f.id).integration, 'pending');
  assert.equal(f.checks, 2);
});

test('expected-target lease rejects a concurrent ancestor update at push time', async (t) => {
  const f = new LivePublicationFixture(t);
  f.ci = 'SUCCESS';
  f.integrationFault = 'race';
  const current = f.git.store.get(f.id);
  f.git.store.approve(f.id, current.version, current.candidate);
  await assert.rejects(f.publication.publish(f.git.signal), /failed/i);
  const origin = f.git.repository.origin;
  const head = git(origin, 'rev-parse', 'refs/heads/arcnexus/' + f.id).trim();
  assert.equal(git(origin, 'rev-parse', 'staging').trim(), head);
  assert.equal(f.git.store.get(f.id).integration, 'pending');
  await assert.rejects(f.publication.publish(f.git.signal), /requires reconciliation/);
});

test('lost integration receipt recovers actual target without repeating verification or mutation', async (t) => {
  const f = new LivePublicationFixture(t);
  f.ci = 'SUCCESS';
  f.integrationFault = 'lost-receipt';
  const current = f.git.store.get(f.id);
  f.git.store.approve(f.id, current.version, current.candidate);
  await assert.rejects(f.publication.publish(f.git.signal), /receipt loss/);
  assert.equal(f.git.store.get(f.id).integration, 'pending');
  const target = git(f.git.repository.origin, 'rev-parse', 'staging').trim();
  const recovered = await f.publication.publish(f.git.signal);
  assert.equal(recovered.integration, 'merged');
  assert.equal(git(f.git.repository.origin, 'rev-parse', 'staging').trim(), target);
  assert.equal(f.checks, 2);
});

registerSuite({
  component: 'publisher',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'lifecycle-effects'],
});
