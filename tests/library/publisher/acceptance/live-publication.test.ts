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
  private command(...[command, cwd, log, signal, options]: Parameters<typeof execute>) {
    const env: NodeJS.ProcessEnv = { ...options!.env, GIT_ALLOW_PROTOCOL: 'file' };
    delete env.GIT_CONFIG_COUNT;
    delete env.GIT_CONFIG_KEY_0;
    delete env.GIT_CONFIG_VALUE_0;
    const args = command.args.map((arg) =>
      arg === 'https://github.com/example/project.git' ? this.git.repository.origin : arg,
    );
    return execute({ ...command, args }, cwd, log, signal, { ...options, env });
  }

  /** Observes the actual pushed ref instead of inventing a successful Git delivery. */
  private head(): string {
    return git(
      this.git.repository.origin,
      'for-each-ref',
      '--format=%(objectname)',
      'refs/heads/arcnexus/' + this.id,
    ).trim();
  }

  /** Implements only the provider requests permitted by this bounded publication workflow. */
  private request(url: string, options: RequestInit): Response {
    this.requests.push(options.method + ' ' + url);
    if (url.endsWith('/graphql')) return Response.json(this.gates());
    const path = new URL(url).pathname.replace('/repos/example/project', '');
    if (!path) return Response.json({ default_branch: 'main' });
    if (path.startsWith('/git/ref/'))
      return this.head()
        ? Response.json({ object: { type: 'commit', sha: this.head() } })
        : new Response('{}', { status: 404 });
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
            baseRefOid: this.git.repository.base,
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
  await assert.rejects(f.publication.publish(f.git.signal), /exact-target assembly/);
  assert.equal(f.checks, 1);
  assert.equal(
    f.requests.filter((entry) => entry.endsWith('/pulls') && entry.startsWith('POST')).length,
    1,
  );
  assert.equal(f.git.effects.effects().length, 4);
  assert.equal(git(f.git.repository.origin, 'rev-parse', 'staging').trim(), pending.base);
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

registerSuite({
  component: 'publisher',
  level: 'acceptance',
  tags: ['deterministic', 'native-host', 'lifecycle-effects'],
});
