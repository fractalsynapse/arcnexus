import { join } from 'node:path';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { DeliveryStore } from '../coordination-store/delivery-store.js';
import type { LifecycleStore } from '../coordination-store/lifecycle-store.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import { DeliveryCommit } from '../operations/delivery-commit.js';
import { GitHubDelivery } from '../operations/github-delivery.js';
import { GitHubPullRequests } from '../operations/github-pull-requests.js';
import { execute } from '../operations/process.js';
import type { SimulationCheckResult } from '../operations/simulated-pull-requests.js';
import type { CapturedPublicationPolicy } from './publication-policy.js';
import { PublicationEffects } from './publication-effects.js';

export interface LivePublicationContext {
  root: string;
  repositoryId: string;
  source: string;
  effects: LifecycleStore;
  deliveries: DeliveryStore;
  policy: CapturedPublicationPolicy;
  credential: () => Promise<string>;
  checks: (
    head: string,
    signal: AbortSignal,
    independent: boolean,
  ) => Promise<SimulationCheckResult>;
  transport?: typeof fetch;
  runner?: typeof execute;
}

const actions = [
  'delivery.commit',
  'delivery.verify',
  'delivery.push',
  'pull-request.create',
  'pull-request.merge',
];

/** Publishes verified live branches and PRs while preserving provider gates and forbidding real releases. */
export class LivePublication {
  private readonly commits: DeliveryCommit;

  private readonly effects: PublicationEffects;

  /** Captures host-only credentials and immutable policy before any object or upstream mutation. */
  constructor(
    private readonly context: LivePublicationContext,
    private readonly delivery: DeliveryRecord,
  ) {
    this.delivery = structuredClone(delivery);
    this.context = { ...context, policy: structuredClone(context.policy) };
    this.assertPolicy();
    this.commits = new DeliveryCommit(
      delivery,
      context.source,
      this.evidenceRoot(),
      context.runner,
    );
    this.effects = new PublicationEffects(
      context.effects,
      context.deliveries,
      delivery,
      {
        id: context.effects.environment(delivery.environment.id).providerId,
        mode: 'live',
        apply: (effect, signal) => this.apply(effect, signal),
        inspect: (effect, signal) => this.inspect(effect, signal),
      },
      context.policy.operation.definitionDigest!,
      actions,
    );
  }

  /** Retains completed effects and observes fresh provider gates on each explicit publication request. */
  async publish(signal: AbortSignal): Promise<DeliveryRecord> {
    try {
      await this.effects.step('commit', 'delivery.commit', signal);
      const verification = await this.effects.effect('delivery.verify', signal);
      if (verification.result?.status !== 'passed') throw new Error('Live delivery checks failed');
      await this.effects.step('push', 'delivery.push', signal);
      await this.effects.step('pull_request', 'pull-request.create', signal);
      this.assertApproval();
      const merged = await this.effects.merge(signal, async () => (await this.ready(signal)).base);
      if (merged.result?.merged !== true) throw new Error('Live integration was not verified');
      this.effects.complete('merge', merged.id);
      return this.effects.current();
    } catch (error) {
      const current = this.effects.current();
      this.context.deliveries.block(current.id, current.version, String(error));
      throw error;
    }
  }

  /** Routes a fixed operation set through real object validation and host-owned provider adapters. */
  private async apply(
    effect: ExternalEffect,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    if (effect.operation === 'delivery.commit') return this.commits.apply(effect, signal);
    if (effect.operation === 'delivery.verify') {
      const result = await this.context.checks(this.head(), signal, true);
      if (!result.evidence.length) throw new Error('Live delivery verification has no evidence');
      return { ...result, head: this.head(), environmentId: this.delivery.environment.id };
    }
    if (effect.operation === 'delivery.push') return this.push().apply(effect, signal);
    if (effect.operation === 'pull-request.create') return this.prs().apply(effect, signal);
    if (effect.operation === 'pull-request.merge') return this.merge(effect, signal);
    throw new Error('Unsupported live publication operation');
  }

  /** Uncertain checks remain inspectable; external mutations reconcile actual refs and correlated PRs. */
  private async inspect(effect: ExternalEffect, signal: AbortSignal): Promise<ExternalObservation> {
    if (effect.operation === 'delivery.commit') return this.commits.inspect(effect);
    if (effect.operation === 'delivery.push') return this.push().inspect(effect, signal);
    if (effect.operation === 'pull-request.create') return this.prs().inspect(effect, signal);
    if (effect.operation === 'pull-request.merge') return this.push().inspectMerge(effect, signal);
    return { status: 'unknown', evidence: effect.id, reason: 'Inspect interrupted verification' };
  }

  /** Verifies the assembled target and reobserves provider requirements immediately before compare-and-swap transport. */
  private async merge(effect: ExternalEffect, signal: AbortSignal) {
    this.assertApproval();
    if ((await this.ready(signal)).base !== effect.input.targetHead)
      throw new Error('GitHub target changed before assembly');
    const assembled = await this.push().assemble(effect, signal);
    const verification = await this.context.checks(assembled, signal, true);
    if (verification.status !== 'passed' || !verification.evidence.length)
      throw new Error('Assembled live delivery verification failed');
    if ((await this.ready(signal)).base !== effect.input.targetHead)
      throw new Error('GitHub target changed during verification');
    this.assertApproval();
    const result = await this.push().integrate(effect, assembled, signal);
    return { ...result, verification };
  }

  /** Observes current-head CI and repository review rules, never treating local approval as provider review. */
  private async ready(signal: AbortSignal) {
    const receipt = this.effects.current().receipts.pull_request;
    if (!receipt) throw new Error('Missing delivery PR receipt');
    const pull = this.context.effects.effect(receipt);
    const gates = await this.prs().readiness(Number(pull.result?.pullRequestId), signal);
    if (!gates.ready) throw new Error('GitHub integration blocked: ' + gates.blockers.join('; '));
    return gates;
  }

  /** Requires an explicit automatic grant or authorization for this exact immutable candidate. */
  private assertApproval(): void {
    if (
      !this.context.policy.operation.automaticMerge &&
      this.effects.current().approval?.candidate !== this.delivery.candidate
    )
      throw new Error('Delivery requires approval for the captured candidate revision');
  }

  /** Recovers the committed object from its durable receipt and revalidates its actual attribution. */
  private head(): string {
    const receipt = this.effects.current().receipts.commit;
    if (!receipt) throw new Error('Missing verified delivery commit receipt');
    const effect = this.context.effects.effect(receipt);
    if (effect.status !== 'completed') throw new Error('Delivery commit is not completed');
    const head = String(effect.result?.head);
    this.commits.validate(this.context.source, head);
    return head;
  }

  /** Binds push to the current milestone while retaining fixed source, target and credential scope. */
  private push(): GitHubDelivery {
    return new GitHubDelivery(
      this.effects.current(),
      this.context.source,
      this.head(),
      this.evidenceRoot(),
      this.context.credential,
      this.context.transport,
      this.context.runner,
    );
  }

  /** Keeps review and CI as provider observations, never synthetic approvals or mutation receipts. */
  private prs(): GitHubPullRequests {
    return new GitHubPullRequests(
      this.effects.current(),
      this.head(),
      this.context.credential,
      this.context.transport,
    );
  }

  /** Keeps transport logs outside source and separates publication evidence by environment. */
  private evidenceRoot(): string {
    return join(this.context.root, 'publication');
  }

  /** Requires the same captured publisher grant used for simulation, with an immutable live destination. */
  private assertPolicy(): void {
    const policy = this.context.policy.operation;
    if (
      this.delivery.environment.mode !== 'live' ||
      policy.action !== 'delivery.publish' ||
      policy.repository !== this.context.repositoryId ||
      !policy.definitionDigest ||
      policy.targetBranch !== this.delivery.target.branch
    )
      throw new Error('Publication policy does not match captured live delivery authority');
  }
}
