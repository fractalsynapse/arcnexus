import { mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import type { RepositoryMaterialization } from '../architecture/bindings.js';
import { assertRepositoryBinding } from '../architecture/bindings.js';
import { execute, git } from './process.js';
import { DeliveryCommit } from './delivery-commit.js';

/** Executes delivery Git effects on a host-bound simulated repository, preserving exact-head recovery. */
export class DeliveryGit {
  private readonly ref: string;

  private readonly privateRef: string;

  private readonly commits: DeliveryCommit;

  /** Binds all paths and revisions to captured host delivery state, never worker arguments. */
  constructor(
    private readonly delivery: DeliveryRecord,
    private readonly repositoryId: string,
    private readonly repository: RepositoryMaterialization,
    private readonly evidenceRoot: string,
  ) {
    this.delivery = structuredClone(delivery);
    this.repository = structuredClone(repository);
    if (delivery.environment.mode !== 'simulation')
      throw new Error('Local delivery transport requires a simulation environment');
    if (!/^[a-f0-9]{64}$/.test(delivery.id)) throw new Error('Unsafe delivery identity');
    this.ref = 'refs/heads/arcnexus/' + delivery.id;
    this.privateRef = 'refs/arcnexus/deliveries/' + delivery.id;
    this.commits = new DeliveryCommit(delivery, repository.source, evidenceRoot);
    this.validateRepository();
  }

  /** Commits or pushes only the captured reviewed tree; arbitrary Git commands are unavailable. */
  async apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>> {
    this.assert(effect);
    signal.throwIfAborted();
    if (effect.operation === 'delivery.commit') return this.commits.apply(effect, signal);
    if (effect.operation === 'delivery.push') return this.push(effect, signal);
    throw new Error('Unsupported delivery Git operation');
  }

  /** Reconciles actual refs after an interrupted effect, rejecting mismatched or redirected objects. */
  inspect(effect: ExternalEffect): ExternalObservation {
    this.assert(effect);
    if (effect.operation === 'delivery.commit') return this.commits.inspect(effect);
    const reference = this.ref;
    const repository = this.repository.origin;
    const head = git(repository, 'for-each-ref', '--format=%(objectname)', reference).trim();
    const evidence = `git:${this.delivery.environment.id}:${reference}`;
    if (!head) return { status: 'absent', evidence };
    try {
      this.commits.validate(repository, head);
      if (
        effect.operation === 'delivery.push' &&
        head !== git(this.repository.source, 'rev-parse', '--verify', this.privateRef).trim()
      )
        throw new Error('Pushed head differs from the authorized delivery commit');
      return { status: 'completed', evidence, result: this.receipt(head) };
    } catch (error) {
      return { status: 'rejected', evidence, reason: String(error) };
    }
  }

  /** Pushes a verified host commit to a generated branch without force or a real upstream destination. */
  private async push(effect: ExternalEffect, signal: AbortSignal) {
    const existing = this.inspect(effect);
    if (existing.status === 'completed') return existing.result;
    if (existing.status !== 'absent')
      throw new Error('Delivery branch conflicts with retained state');
    const head = git(this.repository.source, 'rev-parse', '--verify', this.privateRef).trim();
    this.commits.validate(this.repository.source, head);
    await this.command(
      effect,
      'push',
      ['push', '--porcelain', '--', this.repository.origin, `${head}:${this.ref}`],
      signal,
    );
    const observed = this.inspect(effect);
    if (observed.status !== 'completed') throw new Error('Delivery push requires reconciliation');
    return observed.result;
  }

  /** Reads the actual integration target without inventing a missing upstream branch. */
  targetHead(): string {
    this.validateRepository();
    const ref = 'refs/heads/' + this.delivery.target.branch;
    git(this.repository.origin, 'check-ref-format', ref);
    const head = git(this.repository.origin, 'for-each-ref', '--format=%(objectname)', ref).trim();
    if (!/^[a-f0-9]{40,64}$/.test(head))
      throw new Error('Missing or ambiguous simulated integration target');
    return head;
  }

  /** Assembles a private merge commit without changing the target, retaining conflicts in command evidence. */
  async assemble(effect: ExternalEffect, signal: AbortSignal): Promise<string> {
    this.assertMerge(effect);
    if (this.targetHead() !== effect.input.targetHead)
      throw new Error('Simulated target changed before assembly');
    const head = git(this.repository.source, 'rev-parse', '--verify', this.privateRef).trim();
    this.commits.validate(this.repository.source, head);
    const tree = await this.mergeTree(effect, head, signal);
    return this.pinMerge(effect, tree, head, signal);
  }

  /** Fetches only the captured local target and preserves conflict output before creating a merge object. */
  private async mergeTree(
    effect: ExternalEffect,
    head: string,
    signal: AbortSignal,
  ): Promise<string> {
    const target = String(effect.input.targetHead);
    await this.command(
      effect,
      'fetch-target',
      ['fetch', '--no-tags', '--', this.repository.origin, target],
      signal,
    );
    const merged = await this.command(
      effect,
      'merge-tree',
      ['merge-tree', '--write-tree', target, head],
      signal,
    );
    const tree = merged.split('\n')[0]!.trim();
    if (!/^[a-f0-9]{40,64}$/.test(tree)) throw new Error('Invalid assembled tree');
    return tree;
  }

  /** Pins the assembled object independently of the target so failed checks preserve both versions. */
  private async pinMerge(
    effect: ExternalEffect,
    tree: string,
    head: string,
    signal: AbortSignal,
  ): Promise<string> {
    const target = String(effect.input.targetHead);
    const message = 'ArcNexus simulated merge ' + this.delivery.id;
    const arguments_ = ['commit-tree', tree, '-p', target, '-p', head, '-m', message];
    const commit = (await this.command(effect, 'merge-commit', arguments_, signal)).trim();
    await this.command(
      effect,
      'pin-merge',
      ['update-ref', 'refs/arcnexus/merges/' + effect.inputDigest, commit, ''],
      signal,
    );
    return commit;
  }

  /** Applies only the exact assembled commit after fresh checks, rejecting concurrent target changes. */
  async integrate(
    effect: ExternalEffect,
    assembled: string,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    this.assertMerge(effect);
    const captured = git(
      this.repository.source,
      'rev-parse',
      '--verify',
      'refs/arcnexus/merges/' + effect.inputDigest,
    ).trim();
    if (assembled !== captured) throw new Error('Assembled merge identity changed');
    await this.publishMerge(effect, assembled, signal);
    return {
      ...this.receipt(assembled),
      ref: 'refs/heads/' + this.delivery.target.branch,
      merged: true,
    };
  }

  /** Transfers the checked object and uses compare-and-swap to protect concurrent target updates. */
  private async publishMerge(
    effect: ExternalEffect,
    assembled: string,
    signal: AbortSignal,
  ): Promise<void> {
    const pin = 'refs/arcnexus/merges/' + effect.inputDigest;
    const target = 'refs/heads/' + this.delivery.target.branch;
    await this.command(
      effect,
      'push-merge-object',
      ['push', '--porcelain', '--', this.repository.origin, `${assembled}:${pin}`],
      signal,
    );
    await this.command(
      effect,
      'integrate',
      ['update-ref', target, assembled, String(effect.input.targetHead)],
      signal,
      true,
    );
  }

  /** Recognizes a committed merge after receipt loss without repeating checks or target mutation. */
  inspectMerge(effect: ExternalEffect): ExternalObservation {
    this.assertMerge(effect);
    const merge = git(
      this.repository.source,
      'for-each-ref',
      '--format=%(objectname)',
      'refs/arcnexus/merges/' + effect.inputDigest,
    ).trim();
    const evidence = 'simulated-merge:' + effect.inputDigest;
    if (merge && this.targetHead() === merge)
      return {
        status: 'completed',
        evidence,
        result: {
          ...this.receipt(merge),
          merged: true,
          ref: 'refs/heads/' + this.delivery.target.branch,
        },
      };
    return {
      status: 'unknown',
      evidence,
      reason: 'Merge has no confirmed target receipt; inspect preparation/check evidence',
    };
  }

  /** Requires a host-bound target snapshot and prevents arbitrary ref or candidate selection. */
  private assertMerge(effect: ExternalEffect): void {
    this.assert({
      ...effect,
      operation: 'delivery.push',
      input: { deliveryId: effect.input.deliveryId },
    });
    if (
      effect.operation !== 'pull-request.merge' ||
      !/^[a-f0-9]{40,64}$/.test(String(effect.input.targetHead)) ||
      Object.keys(effect.input).some((key) => !['deliveryId', 'targetHead'].includes(key))
    )
      throw new Error('Invalid simulated merge intent');
  }

  /** Verifies repository, mode, action and complete request scope before effects or recovery. */
  private assert(effect: ExternalEffect): void {
    this.validateRepository();
    if (
      effect.environmentId !== this.delivery.environment.id ||
      effect.runId !== this.delivery.runId ||
      effect.target !== this.delivery.target.repository ||
      !['delivery.commit', 'delivery.push'].includes(effect.operation) ||
      JSON.stringify(effect.input) !== JSON.stringify({ deliveryId: this.delivery.id })
    )
      throw new Error('Git delivery intent is outside captured authority');
  }

  /** Rejects changed source/remote mappings and requires a local bare repository with no further upstream. */
  private validateRepository(): void {
    assertRepositoryBinding(this.repository.source, this.repositoryId, this.repository.repository, {
      schemaVersion: 1,
      tools: {},
      repositories: {},
      materializations: { [this.repositoryId]: this.repository },
    });
    if (
      realpathSync(this.repository.origin) !== this.repository.origin ||
      git(this.repository.origin, 'rev-parse', '--is-bare-repository').trim() !== 'true' ||
      git(this.repository.origin, 'remote').trim()
    )
      throw new Error('Simulated delivery remote is not an isolated local bare repository');
  }

  /** Records immutable Git outcome with explicit simulated provenance. */
  private receipt(head: string): Record<string, unknown> {
    return {
      deliveryId: this.delivery.id,
      head,
      ref: this.ref,
      environmentId: this.delivery.environment.id,
      simulation: true,
    };
  }

  /** Supervises fixed argv with private logs, file-only transport and no credential or hook inheritance. */
  private async command(
    effect: ExternalEffect,
    step: string,
    args: string[],
    signal: AbortSignal,
    remote = false,
  ): Promise<string> {
    const directory = join(this.evidenceRoot, this.delivery.id, String(effect.attempt), step);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const output = join(directory, 'stdout');
    const result = await execute(
      { command: 'git', args: ['-c', 'core.hooksPath=/dev/null', ...args] },
      remote ? this.repository.origin : this.repository.source,
      join(directory, 'command.log'),
      signal,
      { processScope: true, stdout: output, env: this.environment() },
    );
    if (result.exitCode !== 0) throw new Error('Delivery Git failed; inspect ' + result.log);
    return readFileSync(output, 'utf8');
  }

  /** Uses stable commit metadata and denies remote protocols in all managed descendants. */
  private environment(): NodeJS.ProcessEnv {
    return {
      PATH: process.env.PATH,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
      GIT_ALLOW_PROTOCOL: 'file',
      GIT_AUTHOR_NAME: 'ArcNexus delivery',
      GIT_AUTHOR_EMAIL: 'delivery@arcnexus.invalid',
      GIT_COMMITTER_NAME: 'ArcNexus delivery',
      GIT_COMMITTER_EMAIL: 'delivery@arcnexus.invalid',
      GIT_AUTHOR_DATE: this.delivery.createdAt,
      GIT_COMMITTER_DATE: this.delivery.createdAt,
    };
  }
}
