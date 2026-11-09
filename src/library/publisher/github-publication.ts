import { DeliveryCommit } from '../operations/delivery-commit.js';
import { GitHubDelivery } from '../operations/github-delivery.js';
import { GitHubPullRequests } from '../operations/github-pull-requests.js';
import { integrateAssembled } from '../operations/merge-protocol.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { CapturedPublicationPolicy } from './publication-policy.js';
import type { PublicationContext, PublicationProvider } from './publication.js';
import { execute } from '../operations/process.js';
import { join } from 'node:path';

/** GitHub side of publication: real objects, real refs, provider CI and review rules as truth. */
export interface GitHubPublicationContext extends PublicationContext {
  source: string;
  credential: () => Promise<string>;
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

/**
 * Publishes a verified delivery to GitHub without ever treating local approval as provider review.
 *
 * GitHub is the source of truth for readiness, so every gate here is an observation of the remote.
 * Integration runs through the shared merge protocol: the assembled merge commit is verified as its
 * own tree, the target is re-observed after that verification, and only then does the compare-and-
 * swap push happen. Production release is not this provider's operation, so it declares no release
 * step and the route never asks for one.
 */
export class GitHubPublicationProvider implements PublicationProvider {
  readonly mode = 'live' as const;

  readonly actions = actions;

  private readonly commits: DeliveryCommit;

  /** Binds host-only credentials and immutable policy before any object or upstream mutation. */
  constructor(
    private readonly context: GitHubPublicationContext,
    private readonly delivery: DeliveryRecord,
  ) {
    this.commits = new DeliveryCommit(
      delivery,
      context.source,
      this.evidenceRoot(),
      context.runner,
    );
  }

  /** Routes the fixed operation set through real object validation and host-owned adapters. */
  async apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>> {
    if (effect.operation === 'delivery.commit') return this.commits.apply(effect, signal);
    if (effect.operation === 'delivery.verify') {
      const head = this.head();
      const result = await this.context.checks(head, signal, true);
      if (!result.evidence.length) throw new Error('Publication verification has no evidence');
      return { ...result, head, environmentId: this.delivery.environment.id };
    }
    if (effect.operation === 'delivery.push') return this.push().apply(effect, signal);
    if (effect.operation === 'pull-request.create') return this.prs().apply(effect, signal);
    if (effect.operation === 'pull-request.merge') return this.merge(effect, signal);
    throw new Error('Unsupported live publication operation');
  }

  /** Uncertain checks stay inspectable; mutations reconcile actual refs and correlated pull requests. */
  async inspect(effect: ExternalEffect, signal: AbortSignal): Promise<ExternalObservation> {
    if (effect.operation === 'delivery.commit') return this.commits.inspect(effect);
    if (effect.operation === 'delivery.push') return this.push().inspect(effect, signal);
    if (effect.operation === 'pull-request.create') return this.prs().inspect(effect, signal);
    if (effect.operation === 'pull-request.merge') return this.push().inspectMerge(effect, signal);
    return { status: 'unknown', evidence: effect.id, reason: 'Inspect interrupted verification' };
  }

  /** Observes provider CI and review rules, refusing while the remote still blocks. */
  async gates(signal: AbortSignal): Promise<{ base: string }> {
    const receipt = this.current().receipts.pull_request;
    if (!receipt) throw new Error('Missing delivery PR receipt');
    const pull = this.context.effects.effect(receipt);
    const gates = await this.prs().readiness(Number(pull.result?.pullRequestId), signal);
    if (!gates.ready) throw new Error('GitHub integration blocked: ' + gates.blockers.join('; '));
    return gates;
  }

  /** Recovers the committed object from its durable receipt and revalidates its attribution. */
  head(): string {
    const receipt = this.current().receipts.commit;
    if (!receipt) throw new Error('Missing verified delivery commit receipt');
    const effect = this.context.effects.effect(receipt);
    if (effect.status !== 'completed') throw new Error('Delivery commit is not completed');
    const head = String(effect.result?.head);
    this.commits.validate(this.context.source, head);
    return head;
  }

  /** Requires a captured live destination for this repository and branch. */
  assertPolicy(
    delivery: DeliveryRecord,
    repositoryId: string,
    policy: CapturedPublicationPolicy,
  ): void {
    if (delivery.environment.mode !== 'live')
      throw new Error('Live publication requires a live delivery environment');
    if (policy.operation.repository !== repositoryId || !policy.operation.targetBranch)
      throw new Error('Live publication policy lacks captured destination authority');
  }

  /** GitHub holds its own state, so nothing is released here. */
  close(): void {}

  /** Assembles, verifies and integrates the exact merge commit under the shared protocol. */
  private async merge(effect: ExternalEffect, signal: AbortSignal) {
    return integrateAssembled(
      {
        gates: (_item, cancellation) => this.gates(cancellation),
        assemble: (item, cancellation) => this.push().assemble(item, cancellation),
        integrate: (item, assembled, cancellation) =>
          this.push().integrate(item, assembled, cancellation),
      },
      effect,
      (head, cancellation, independent) => this.context.checks(head, cancellation, independent),
      () => undefined,
      signal,
    );
  }

  /** Reads the delivery freshly so an intervening approval is seen. */
  private current(): DeliveryRecord {
    return this.context.deliveries.get(this.delivery.id);
  }

  /** Binds push to the current milestone while retaining fixed source, target and credential scope. */
  private push(): GitHubDelivery {
    return new GitHubDelivery(
      this.current(),
      this.context.source,
      this.head(),
      this.evidenceRoot(),
      this.context.credential,
      this.context.transport,
      this.context.runner,
    );
  }

  /** Keeps review and CI as provider observations, never synthetic approvals or receipts. */
  private prs(): GitHubPullRequests {
    return new GitHubPullRequests(
      this.current(),
      this.head(),
      this.context.credential,
      this.context.transport,
    );
  }

  /** Keeps transport logs outside source and separates publication evidence by environment. */
  private evidenceRoot(): string {
    return join(this.context.root, 'publication');
  }
}
