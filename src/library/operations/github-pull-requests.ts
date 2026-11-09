import { publicationContent } from './repository-documents.js';
import { createHash } from 'node:crypto';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import { GitHubTransport } from './github-transport.js';
import { deliveryBranch } from './delivery-commit.js';

/** Creates exact-head delivery PRs without granting review, integration or release authority. */
export class GitHubPullRequests {
  private readonly client: GitHubTransport;

  private readonly branch: string;

  /** Captures immutable verified delivery and pushed-head identity before any credential access. */
  constructor(
    private readonly delivery: DeliveryRecord,
    private readonly head: string,
    credential: () => Promise<string>,
    transport: typeof fetch = fetch,
  ) {
    this.delivery = structuredClone(delivery);
    if (
      delivery.environment.mode !== 'live' ||
      delivery.engineering !== 'verified' ||
      !delivery.receipts.push ||
      !/^[a-f0-9]{64}$/.test(delivery.id) ||
      !/^[a-f0-9]{40,64}$/.test(head)
    )
      throw new Error('GitHub PR requires a verified live delivery and captured pushed head');
    this.branch = deliveryBranch(delivery);
    this.client = new GitHubTransport(delivery.target.repository, credential, transport);
  }

  /** Observes current provider gates without treating local delivery approval as a GitHub review. */
  async readiness(number: number, signal: AbortSignal) {
    const repository = await this.client.pullRequest(number, signal);
    const pull = repository.pullRequest;
    if (
      pull?.number !== number ||
      pull.headRefOid !== this.head ||
      pull.headRefName !== this.branch ||
      pull.headRepository?.nameWithOwner !== this.delivery.target.repository ||
      pull.baseRefName !== this.delivery.target.branch ||
      pull.url !== `https://github.com/${this.delivery.target.repository}/pull/${number}`
    )
      throw new Error('GitHub readiness differs from captured delivery attribution');
    const blockers = this.blockers(repository);
    return {
      pullRequestId: number,
      head: this.head,
      base: pull.baseRefOid,
      environmentId: this.delivery.environment.id,
      simulation: false,
      ready: blockers.length === 0,
      blockers,
      reviewDecision: pull.reviewDecision,
      mergeState: pull.mergeStateStatus,
    };
  }

  /** Fails closed on missing checks, unknown review state, conflicts and protected integration targets. */
  private blockers(repository: any): string[] {
    const pull = repository.pullRequest,
      blockers: string[] = [];
    const commit = pull.commits?.nodes?.[0]?.commit;
    const checks = commit?.statusCheckRollup;
    const target = this.delivery.target.branch;
    if (
      !repository.defaultBranchRef?.name ||
      [repository.defaultBranchRef.name, 'main', 'master'].includes(target)
    )
      blockers.push('Default or main integration is not authorized');
    if (pull.state !== 'OPEN' || pull.isDraft !== false) blockers.push('PR is not open and ready');
    if (pull.mergeable !== 'MERGEABLE' || pull.mergeStateStatus !== 'CLEAN')
      blockers.push('Provider merge requirements are not satisfied');
    if (!['APPROVED', null].includes(pull.reviewDecision))
      blockers.push('Provider review requirements are not satisfied');
    if (
      commit?.oid !== this.head ||
      checks?.state !== 'SUCCESS' ||
      !Number.isSafeInteger(checks?.contexts?.totalCount) ||
      checks.contexts.totalCount < 1
    )
      blockers.push('Current-head CI evidence is missing or unsuccessful');
    if (!/^[a-f0-9]{40,64}$/.test(String(pull.baseRefOid)))
      blockers.push('Integration target revision is unavailable');
    return blockers;
  }

  /** Checks actual upstream refs and reuses exact prior intent instead of creating duplicate PRs. */
  async apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>> {
    this.assert(effect);
    await this.target(signal);
    const prior = await this.matches(effect, signal);
    if (prior.length > 1) throw new Error('Ambiguous GitHub delivery PRs require reconciliation');
    if (prior.length === 1) return this.receipt(prior[0]);
    const response = await this.client.request('/pulls', signal, 'POST', {
      title: publicationContent(effect.input).title,
      body: this.body(effect),
      head: this.branch,
      base: this.delivery.target.branch,
      maintainer_can_modify: false,
    });
    return this.receipt(response);
  }

  /** Requires a unique correlation marker and exact attribution; absence never authorizes an uncertain retry. */
  async inspect(effect: ExternalEffect, signal: AbortSignal): Promise<ExternalObservation> {
    this.assert(effect);
    const matches = await this.matches(effect, signal);
    const evidence = `github-pr:${effect.id}:matches=${matches.length}`;
    if (matches.length !== 1) return { status: 'unknown', evidence };
    try {
      return { status: 'completed', evidence, result: this.receipt(matches[0]) };
    } catch (error) {
      return { status: 'rejected', evidence, reason: String(error) };
    }
  }

  /** Rejects main/default integration and any branch that no longer contains the verified pushed commit. */
  private async target(signal: AbortSignal): Promise<void> {
    const repository = await this.client.request('', signal);
    const target = this.delivery.target.branch;
    if (
      typeof repository.default_branch !== 'string' ||
      target === repository.default_branch ||
      ['main', 'master'].includes(target) ||
      !target.trim()
    )
      throw new Error('Delivery PR cannot target the default or main branch');
    const reference = await this.client.request(
      '/git/ref/heads/' + encodeURIComponent(this.branch),
      signal,
    );
    if (reference.object?.type !== 'commit' || reference.object.sha !== this.head)
      throw new Error('Delivery branch no longer matches the verified pushed head');
    await this.client.request('/branches/' + encodeURIComponent(target), signal);
  }

  /** Searches all provider pages using both branch selection and an exact durable intent marker. */
  private async matches(effect: ExternalEffect, signal: AbortSignal): Promise<any[]> {
    const owner = this.delivery.target.repository.split('/')[0]!;
    const head = encodeURIComponent(owner + ':' + this.branch);
    const base = encodeURIComponent(this.delivery.target.branch);
    const entries = await this.client.pages(`/pulls?state=all&head=${head}&base=${base}`, signal);
    return entries.filter(
      (entry) => typeof entry.body === 'string' && entry.body.endsWith(this.marker(effect)),
    );
  }

  /** Keeps model prose out of host identity while retaining links to immutable local verification evidence. */
  private body(effect: ExternalEffect): string {
    return publicationContent(effect.input).body + '\n\n' + this.marker(effect);
  }

  /** Correlates the complete persisted intent, including its captured environment and input digest. */
  private marker(effect: ExternalEffect): string {
    const digest = createHash('sha256')
      .update(JSON.stringify([effect.environmentId, effect.id, effect.inputDigest]))
      .digest('hex');
    return `<!-- arcnexus-effect:${digest} -->`;
  }

  /** Rejects redirects, changed heads and foreign branches before accepting a provider receipt. */
  private receipt(value: any): Record<string, unknown> {
    if (
      !Number.isSafeInteger(value?.number) ||
      value.number <= 0 ||
      value.head?.sha !== this.head ||
      value.head?.ref !== this.branch ||
      value.head?.repo?.full_name !== this.delivery.target.repository ||
      value.base?.ref !== this.delivery.target.branch ||
      value.base?.repo?.full_name !== this.delivery.target.repository ||
      value.html_url !==
        `https://github.com/${this.delivery.target.repository}/pull/${value.number}`
    )
      throw new Error('GitHub PR receipt differs from captured delivery attribution');
    return {
      pullRequestId: value.number,
      url: value.html_url,
      head: this.head,
      deliveryId: this.delivery.id,
      environmentId: this.delivery.environment.id,
      simulation: false,
    };
  }

  /** Rejects caller substitutions before any host credential or provider request is used. */
  private assert(effect: ExternalEffect): void {
    if (
      effect.environmentId !== this.delivery.environment.id ||
      effect.runId !== this.delivery.runId ||
      effect.target !== this.delivery.target.repository ||
      effect.operation !== 'pull-request.create' ||
      JSON.stringify(effect.input) !==
        JSON.stringify({ deliveryId: this.delivery.id, ...this.delivery.publicationDocument })
    )
      throw new Error('GitHub PR intent is outside captured delivery authority');
  }
}
