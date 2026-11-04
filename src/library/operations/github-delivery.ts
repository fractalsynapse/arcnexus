import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import { GitHubTransport } from './github-transport.js';
import { execute, git } from './process.js';

const gitPolicy = [
  '-c',
  'core.hooksPath=/dev/null',
  '-c',
  'init.templateDir=',
  '-c',
  'credential.helper=',
  '-c',
  'http.followRedirects=false',
  '-c',
  'http.sslVerify=true',
];

/** Publishes a verified host commit through isolated Git configuration and repository-scoped credentials. */
export class GitHubDelivery {
  private readonly client: GitHubTransport;

  private readonly ref: string;

  /** Validates immutable delivery and local objects before resolving any upstream credentials. */
  constructor(
    private readonly delivery: DeliveryRecord,
    private readonly source: string,
    private readonly head: string,
    private readonly evidenceRoot: string,
    private readonly credential: () => Promise<string>,
    transport: typeof fetch = fetch,
    private readonly runner: typeof execute = execute,
  ) {
    this.delivery = structuredClone(delivery);
    if (
      delivery.environment.mode !== 'live' ||
      delivery.engineering !== 'verified' ||
      !['committed', 'pushed'].includes(delivery.delivery) ||
      !/^[a-f0-9]{64}$/.test(delivery.id) ||
      !/^[a-f0-9]{40,64}$/.test(head)
    )
      throw new Error('GitHub push requires a committed verified live delivery');
    this.ref = 'refs/heads/arcnexus/' + delivery.id;
    this.client = new GitHubTransport(delivery.target.repository, credential, transport);
    this.local();
  }

  /** Publishes only the captured commit and refuses a conflicting existing generated branch. */
  async apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>> {
    this.assert(effect);
    const before = await this.remote(signal);
    if (before === this.head) return this.receipt();
    if (before) throw new Error('GitHub delivery branch conflicts with verified head');
    const directory = await this.prepare(effect, signal);
    const credentials = await this.authorization();
    await this.command(
      directory,
      'push',
      [
        'push',
        '--porcelain',
        '--',
        `https://github.com/${this.delivery.target.repository}.git`,
        `${this.head}:${this.ref}`,
      ],
      signal,
      credentials,
    );
    if ((await this.remote(signal)) !== this.head)
      throw new Error('GitHub push requires reconciliation; remote head was not confirmed');
    return { ...this.receipt(), commandEvidence: directory };
  }

  /** Missing uncertain refs remain unknown; only exact upstream identity can complete a lost receipt. */
  async inspect(effect: ExternalEffect, signal: AbortSignal): Promise<ExternalObservation> {
    this.assert(effect);
    const head = await this.remote(signal);
    const evidence = `github-ref:${this.delivery.target.repository}:${this.ref}`;
    if (!head) return { status: 'unknown', evidence };
    return head === this.head
      ? { status: 'completed', evidence, result: this.receipt() }
      : { status: 'rejected', evidence, reason: 'Remote delivery head changed' };
  }

  /** Imports immutable objects into a fresh host-only bare repository without candidate configuration or hooks. */
  private async prepare(effect: ExternalEffect, signal: AbortSignal): Promise<string> {
    const suffix = relative(this.source, resolve(this.evidenceRoot));
    if (!suffix.startsWith('../') && suffix !== '..')
      throw new Error('Delivery transport storage must be outside source');
    mkdirSync(this.evidenceRoot, { recursive: true, mode: 0o700 });
    if (realpathSync(this.evidenceRoot) !== resolve(this.evidenceRoot))
      throw new Error('Aliased delivery transport storage');
    const identity = createHash('sha256').update(effect.id).digest('hex').slice(0, 16);
    const directory = mkdtempSync(join(this.evidenceRoot, this.delivery.id + '-' + identity + '-'));
    await this.command(directory, 'init', ['init', '--bare', 'repository.git'], signal);
    await this.command(
      directory,
      'fetch',
      ['fetch', '--no-tags', '--', this.source, this.head],
      signal,
    );
    return directory;
  }

  /** Supervises fixed host Git arguments; credentials never enter argv or command evidence. */
  private async command(
    directory: string,
    stage: string,
    args: string[],
    signal: AbortSignal,
    credentials: NodeJS.ProcessEnv = {},
  ): Promise<void> {
    const cwd = stage === 'init' ? directory : join(directory, 'repository.git');
    const result = await this.runner(
      {
        command: 'git',
        args: [...gitPolicy, ...args],
      },
      cwd,
      join(directory, stage + '.log'),
      signal,
      {
        processScope: true,
        fileOutput: true,
        env: this.environment(credentials),
      },
    );
    if (result.exitCode !== 0) throw new Error('Delivery Git failed; inspect ' + result.log);
  }

  /** Removes ambient credential helpers, tracing and Git overrides from every host transport child. */
  private environment(credentials: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    return {
      PATH: process.env.PATH,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
      GIT_ALLOW_PROTOCOL: 'file',
      ...credentials,
    };
  }

  /** Supplies a path-scoped header only to the trusted HTTPS push, never to local preparation or evidence. */
  private async authorization(): Promise<NodeJS.ProcessEnv> {
    const token = await this.credential();
    if (!token.trim()) throw new Error('GitHub host credential is unavailable');
    const authorization = Buffer.from('x-access-token:' + token).toString('base64');
    return {
      GIT_ALLOW_PROTOCOL: 'https',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: `http.https://github.com/${this.delivery.target.repository}.git.extraHeader`,
      GIT_CONFIG_VALUE_0: 'Authorization: Basic ' + authorization,
    };
  }

  /** Reads the exact generated ref and treats provider authorization failures as errors, not absence. */
  private async remote(signal: AbortSignal): Promise<string | undefined> {
    try {
      const value = await this.client.request(
        '/git/ref/heads/' + encodeURIComponent('arcnexus/' + this.delivery.id),
        signal,
      );
      if (value.object?.type !== 'commit' || !/^[a-f0-9]{40,64}$/.test(value.object.sha))
        throw new Error('Invalid GitHub delivery ref response');
      return value.object.sha;
    } catch (error) {
      if ((error as { status?: number }).status === 404) return undefined;
      throw error;
    }
  }

  /** Rechecks the tree, base parent and attribution instead of trusting a caller-provided commit hash alone. */
  private local(): void {
    if (realpathSync(this.source) !== resolve(this.source))
      throw new Error('Aliased delivery source');
    const tree = git(this.source, 'rev-parse', `${this.delivery.candidate}^{tree}`).trim();
    const actual = git(this.source, 'show', '-s', '--format=%T%n%P%n%s', this.head).trim();
    if (
      actual !==
      [tree, this.delivery.base, 'ArcNexus verified delivery ' + this.delivery.id].join('\n')
    )
      throw new Error('Local commit differs from verified delivery tree, base or attribution');
  }

  /** Rejects cross-run, simulation and substituted intent before any provider request. */
  private assert(effect: ExternalEffect): void {
    if (
      effect.environmentId !== this.delivery.environment.id ||
      effect.runId !== this.delivery.runId ||
      effect.target !== this.delivery.target.repository ||
      effect.operation !== 'delivery.push' ||
      JSON.stringify(effect.input) !== JSON.stringify({ deliveryId: this.delivery.id })
    )
      throw new Error('GitHub push intent is outside captured delivery authority');
    this.local();
  }

  /** Retains exact upstream attribution without credential material or mutable provider prose. */
  private receipt(): Record<string, unknown> {
    return {
      deliveryId: this.delivery.id,
      head: this.head,
      ref: this.ref,
      environmentId: this.delivery.environment.id,
      simulation: false,
    };
  }
}
