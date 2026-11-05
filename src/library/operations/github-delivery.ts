import { gitAuthorization, gitEnvironment, gitPolicy } from './github-git.js';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import { GitHubTransport } from './github-transport.js';
import { execute, git } from './process.js';
import { DeliveryAssembly } from './delivery-assembly.js';
import { DeliveryCommit, deliveryBranch } from './delivery-commit.js';

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
    this.ref = 'refs/heads/' + deliveryBranch(delivery);
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
    const credentials = await gitAuthorization(this.delivery.target.repository, this.credential);
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

  /** Fetches the exact captured target through scoped credentials before assembling private merge objects. */
  async assemble(effect: ExternalEffect, signal: AbortSignal): Promise<string> {
    this.assertMerge(effect);
    if ((await this.target(signal)) !== effect.input.targetHead)
      throw new Error('GitHub target changed before assembly');
    const directory = await this.prepare(effect, signal);
    const target = String(effect.input.targetHead);
    await this.command(
      directory,
      'fetch-target',
      [
        'fetch',
        '--no-tags',
        '--',
        `https://github.com/${this.delivery.target.repository}.git`,
        target,
      ],
      signal,
      await gitAuthorization(this.delivery.target.repository, this.credential),
    );
    await this.command(
      directory,
      'import-target',
      ['fetch', '--no-tags', '--', join(directory, 'repository.git'), target],
      signal,
      {},
      this.source,
    );
    return this.assembly().assemble(effect, this.head, signal);
  }

  /** Advances only an attributed descendant of the captured target with an explicit compare-and-swap lease. */
  async integrate(effect: ExternalEffect, assembled: string, signal: AbortSignal) {
    this.assertMerge(effect);
    this.validateAssembly(effect, assembled);
    if ((await this.target(signal)) !== effect.input.targetHead)
      throw new Error('GitHub target changed before integration');
    const directory = await this.prepare(effect, signal, assembled);
    const ref = 'refs/heads/' + this.delivery.target.branch;
    await this.command(
      directory,
      'integrate',
      [
        'push',
        '--porcelain',
        `--force-with-lease=${ref}:${String(effect.input.targetHead)}`,
        '--',
        `https://github.com/${this.delivery.target.repository}.git`,
        `${assembled}:${ref}`,
      ],
      signal,
      await gitAuthorization(this.delivery.target.repository, this.credential),
    );
    if ((await this.target(signal)) !== assembled)
      throw new Error('GitHub integration requires reconciliation');
    return { ...this.receipt(), head: assembled, ref, merged: true, commandEvidence: directory };
  }

  /** Requires both parent attribution and the host's immutable assembly pin before integration. */
  private validateAssembly(effect: ExternalEffect, assembled: string): void {
    this.assembly().validate(effect, this.head, assembled);
    const pin = git(
      this.source,
      'rev-parse',
      '--verify',
      'refs/arcnexus/merges/' + effect.inputDigest,
    ).trim();
    if (pin !== assembled) throw new Error('Assembled merge identity changed');
  }

  /** Recognizes only an exact pinned assembled result after receipt loss; missing evidence never permits replay. */
  async inspectMerge(effect: ExternalEffect, signal: AbortSignal): Promise<ExternalObservation> {
    this.assertMerge(effect);
    const assembled = git(
      this.source,
      'for-each-ref',
      '--format=%(objectname)',
      'refs/arcnexus/merges/' + effect.inputDigest,
    ).trim();
    const evidence = 'github-merge:' + effect.inputDigest;
    if (assembled) {
      this.assembly().validate(effect, this.head, assembled);
      if ((await this.target(signal)) === assembled)
        return {
          status: 'completed',
          evidence,
          result: {
            ...this.receipt(),
            head: assembled,
            merged: true,
            ref: 'refs/heads/' + this.delivery.target.branch,
          },
        };
    }
    return { status: 'unknown', evidence, reason: 'Inspect retained assembly and provider state' };
  }

  /** Rejects main, default-like and malformed destinations before target transport; provider gates additionally check default identity. */
  private assertMerge(effect: ExternalEffect): void {
    this.assert({
      ...effect,
      operation: 'delivery.push',
      input: { deliveryId: effect.input.deliveryId },
    });
    if (
      effect.operation !== 'pull-request.merge' ||
      !/^[a-f0-9]{40,64}$/.test(String(effect.input.targetHead)) ||
      Object.keys(effect.input).some((key) => !['deliveryId', 'targetHead'].includes(key)) ||
      ['main', 'master'].includes(this.delivery.target.branch)
    )
      throw new Error('Invalid live merge authority');
    git(this.source, 'check-ref-format', 'refs/heads/' + this.delivery.target.branch);
  }

  /** Uses the same deterministic local merge and attribution rules as the simulated provider. */
  private assembly(): DeliveryAssembly {
    return new DeliveryAssembly(this.delivery, this.source, this.evidenceRoot);
  }

  /** Reads an exact target ref with no mutable local tracking-ref fallback. */
  private target(signal: AbortSignal): Promise<string> {
    return this.client.branchHead(this.delivery.target.branch, signal);
  }

  /** Imports immutable objects into a fresh host-only bare repository without candidate configuration or hooks. */
  private async prepare(
    effect: ExternalEffect,
    signal: AbortSignal,
    head = this.head,
  ): Promise<string> {
    const suffix = relative(this.source, resolve(this.evidenceRoot));
    if (!suffix.startsWith('../') && suffix !== '..')
      throw new Error('Delivery transport storage must be outside source');
    mkdirSync(this.evidenceRoot, { recursive: true, mode: 0o700 });
    if (realpathSync(this.evidenceRoot) !== resolve(this.evidenceRoot))
      throw new Error('Aliased delivery transport storage');
    const identity = createHash('sha256').update(effect.id).digest('hex').slice(0, 16);
    const directory = mkdtempSync(join(this.evidenceRoot, this.delivery.id + '-' + identity + '-'));
    await this.command(directory, 'init', ['init', '--bare', 'repository.git'], signal);
    await this.command(directory, 'fetch', ['fetch', '--no-tags', '--', this.source, head], signal);
    return directory;
  }

  /** Supervises fixed host Git arguments; credentials never enter argv or command evidence. */
  private async command(
    directory: string,
    stage: string,
    args: string[],
    signal: AbortSignal,
    credentials: NodeJS.ProcessEnv = {},
    source?: string,
  ): Promise<void> {
    const cwd = source ?? (stage === 'init' ? directory : join(directory, 'repository.git'));
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
        env: gitEnvironment(credentials),
      },
    );
    if (result.exitCode !== 0) throw new Error('Delivery Git failed; inspect ' + result.log);
  }

  /** Reads the exact generated ref and treats provider authorization failures as errors, not absence. */
  private async remote(signal: AbortSignal): Promise<string | undefined> {
    try {
      const value = await this.client.request(
        '/git/ref/heads/' + encodeURIComponent(deliveryBranch(this.delivery)),
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

  /** Reuses the shared commit attribution check before transport or recovery observes upstream state. */
  private local(): void {
    new DeliveryCommit(this.delivery, this.source, this.evidenceRoot).validate(
      this.source,
      this.head,
    );
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
