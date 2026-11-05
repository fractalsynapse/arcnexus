import { importObservedHead } from './github-git.js';
import { GitHubTransport } from './github-transport.js';
import { createHash } from 'node:crypto';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import type { UpstreamProvider } from './upstream-execution.js';

/** Supplies the GitHub credential only at the host/provider boundary. */
export async function githubHostCredential(): Promise<string> {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GitHub host credential is unavailable');
  return token;
}

/** Pins a promotion to the provider's target without updating a checkout or a Git ref. */
export async function githubBranchHead(
  repository: string,
  branch: string,
  signal: AbortSignal,
  target: { source: string; evidence: string },
) {
  const credential =
    process.env.GH_TOKEN || process.env.GITHUB_TOKEN ? githubHostCredential : undefined;
  const head = await new GitHubTransport(repository, credential).branchHead(branch, signal);
  await importObservedHead(target.source, target.evidence, repository, head, credential, signal);
  return head;
}

/** Implements allowlisted GitHub collaboration with host-only credentials and conservative recovery. */
export class GitHubUpstream implements UpstreamProvider {
  readonly mode = 'live' as const;

  private readonly client: GitHubTransport;

  /** Captures one destination; credential resolution stays outside workers and durable evidence. */
  constructor(
    readonly id: string,
    private readonly environmentId: string,
    private readonly repository: string,
    credential: () => Promise<string>,
    transport: typeof fetch = fetch,
  ) {
    this.client = new GitHubTransport(repository, credential, transport);
  }

  /** Sends one authorized issue or comment mutation; transport failure remains uncertain. */
  async apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>> {
    this.assert(effect);
    const endpoint = this.endpoint(effect);
    const body = this.text(effect, 'body') + '\n\n' + this.marker(effect);
    const input =
      effect.operation === 'issue.create' ? { title: this.text(effect, 'title'), body } : { body };
    const response = await this.client.request(endpoint, signal, 'POST', input);
    return this.receipt(response);
  }

  /** Finds exact retained correlation markers; missing or ambiguous results never authorize replay. */
  async inspect(effect: ExternalEffect, signal: AbortSignal): Promise<ExternalObservation> {
    this.assert(effect);
    const endpoint = this.endpoint(effect);
    const matches: Record<string, unknown>[] = [];
    for (let page = 1; ; page++) {
      const result = await this.client.request(
        `${endpoint}?state=all&per_page=100&page=${page}`,
        signal,
      );
      if (!Array.isArray(result)) throw new Error('Invalid GitHub listing response');
      for (const item of result) {
        if (
          typeof item?.body === 'string' &&
          item.body.endsWith(this.marker(effect)) &&
          (effect.operation !== 'issue.create' || !item.pull_request)
        )
          matches.push(item);
      }
      if (result.length < 100) break;
    }
    const evidence = `github:${this.repository}:${effect.id}:matches=${matches.length}`;
    return matches.length === 1
      ? { status: 'completed', evidence, result: this.receipt(matches[0]) }
      : { status: 'unknown', evidence };
  }

  /** Restricts paths to the captured repository and supported operation contracts. */
  private endpoint(effect: ExternalEffect): string {
    const base = '/issues';
    if (effect.operation === 'issue.create') return base;
    if (effect.operation !== 'issue.comment') throw new Error('Unsupported GitHub operation');
    const number = effect.input.issueId;
    if (typeof number !== 'number' || !Number.isSafeInteger(number) || number <= 0)
      throw new Error('Expected GitHub issue number');
    return `${base}/${number}/comments`;
  }

  /** Retains provider identities and provenance without copying tokens or arbitrary response content. */
  private receipt(value: unknown): Record<string, unknown> {
    const data = value as Record<string, unknown> | null;
    if (!data || typeof data.id !== 'number' || typeof data.html_url !== 'string')
      throw new Error('Invalid GitHub mutation receipt');
    return {
      id: data.id,
      issueId: data.number,
      url: data.html_url,
      environmentId: this.environmentId,
      simulation: false,
    };
  }

  /** Binds reconciliation to the complete durable intent rather than mutable prose similarity. */
  private marker(effect: ExternalEffect): string {
    const digest = createHash('sha256')
      .update(JSON.stringify([effect.environmentId, effect.id, effect.inputDigest]))
      .digest('hex');
    return `<!-- arcnexus-effect:${digest} -->`;
  }

  /** Rejects empty content before credential acquisition or network access. */
  private text(effect: ExternalEffect, key: string): string {
    const value = effect.input[key];
    if (typeof value !== 'string' || !value.trim()) throw new Error('Missing ' + key);
    return value;
  }

  /** Prevents simulation or other-repository intents from crossing the credential boundary. */
  private assert(effect: ExternalEffect): void {
    if (effect.environmentId !== this.environmentId || effect.target !== this.repository)
      throw new Error('GitHub effect environment or destination mismatch');
  }
}
