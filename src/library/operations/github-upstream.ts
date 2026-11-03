import { createHash } from 'node:crypto';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import type { UpstreamProvider } from './upstream-execution.js';

/** Implements allowlisted GitHub collaboration with host-only credentials and conservative recovery. */
export class GitHubUpstream implements UpstreamProvider {
  readonly mode = 'live' as const;

  /** Captures one destination; credential resolution stays outside workers and durable evidence. */
  constructor(
    readonly id: string,
    private readonly environmentId: string,
    private readonly repository: string,
    private readonly credential: () => Promise<string>,
    private readonly transport: typeof fetch = fetch,
  ) {
    if (
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
      repository.split('/').some((part) => part === '.' || part === '..')
    )
      throw new Error('Expected an explicit GitHub owner/repository');
  }

  /** Sends one authorized issue or comment mutation; transport failure remains uncertain. */
  async apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>> {
    this.assert(effect);
    const endpoint = this.endpoint(effect);
    const body = this.text(effect, 'body') + '\n\n' + this.marker(effect);
    const input =
      effect.operation === 'issue.create' ? { title: this.text(effect, 'title'), body } : { body };
    const response = await this.request(endpoint, signal, input);
    return this.receipt(response);
  }

  /** Finds exact retained correlation markers; missing or ambiguous results never authorize replay. */
  async inspect(effect: ExternalEffect, signal: AbortSignal): Promise<ExternalObservation> {
    this.assert(effect);
    const endpoint = this.endpoint(effect);
    const matches: Record<string, unknown>[] = [];
    for (let page = 1; ; page++) {
      const result = await this.request(`${endpoint}?state=all&per_page=100&page=${page}`, signal);
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
    const base = `/repos/${this.repository}/issues`;
    if (effect.operation === 'issue.create') return base;
    if (effect.operation !== 'issue.comment') throw new Error('Unsupported GitHub operation');
    const number = effect.input.issueId;
    if (typeof number !== 'number' || !Number.isSafeInteger(number) || number <= 0)
      throw new Error('Expected GitHub issue number');
    return `${base}/${number}/comments`;
  }

  /** Keeps redirects from forwarding credentials and excludes raw response bodies from errors. */
  private async request(path: string, signal: AbortSignal, body?: object): Promise<unknown> {
    signal.throwIfAborted();
    const token = await this.credential();
    if (!token.trim()) throw new Error('GitHub host credential is unavailable');
    signal.throwIfAborted();
    const response = await this.transport('https://api.github.com' + path, {
      method: body ? 'POST' : 'GET',
      signal,
      redirect: 'error',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2026-03-10',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`GitHub request failed with HTTP ${response.status}`);
    return response.json();
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
