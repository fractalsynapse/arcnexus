import { ProviderStore } from '../coordination-store/provider-store.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import type { UpstreamProvider } from './upstream-execution.js';

/** Implements persistent simulated collaboration with real rejection and optimistic concurrency. */
export class SimulatedUpstream implements UpstreamProvider {
  readonly mode = 'simulation' as const;

  /** Binds an isolated provider database to exactly one captured environment and target. */
  constructor(
    readonly id: string,
    private readonly environmentId: string,
    private readonly target: string,
    private readonly store: ProviderStore,
  ) {}

  /** Applies collaboration changes atomically; unsupported publication cannot silently succeed. */
  async apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>> {
    signal.throwIfAborted();
    this.assert(effect);
    return this.store.apply(effect, () => this.change(effect));
  }

  /** Looks up provider receipts after host loss, including effects whose host receipt was never saved. */
  async inspect(effect: ExternalEffect, signal: AbortSignal): Promise<ExternalObservation> {
    signal.throwIfAborted();
    this.assert(effect);
    return this.store.inspect(effect);
  }

  /** Dispatches only implemented provider operations; lifecycle gaps remain visible. */
  private change(effect: ExternalEffect): Record<string, unknown> {
    if (effect.operation === 'issue.create') return this.issue(effect);
    if (effect.operation === 'issue.comment') return this.comment(effect);
    if (effect.operation === 'issue.close') return this.close(effect);
    throw new Error('Unsupported simulated upstream operation: ' + effect.operation);
  }

  /** Creates an actionable tracking issue with explicit simulation provenance. */
  private issue(effect: ExternalEffect): Record<string, unknown> {
    const id = `${this.environmentId}:issue:${effect.id}`;
    const data = {
      title: this.text(effect, 'title'),
      body: this.text(effect, 'body'),
      state: 'open',
      simulation: true,
      runId: effect.runId,
      assignmentId: effect.assignmentId,
      environmentId: this.environmentId,
    };
    this.store.create({ id, kind: 'issue', revision: 1, data });
    return { id, issueId: id, revision: 1, simulation: true };
  }

  /** Adds a comment to an existing issue and retains correlation with its originating assignment. */
  private comment(effect: ExternalEffect): Record<string, unknown> {
    const issue = this.store.resource(this.text(effect, 'issueId'));
    if (issue.kind !== 'issue' || issue.data.environmentId !== this.environmentId)
      throw new Error('Comment target is not an issue in this environment');
    const id = `${this.environmentId}:comment:${effect.id}`;
    this.store.create({
      id,
      kind: 'comment',
      revision: 1,
      data: {
        issueId: issue.id,
        body: this.text(effect, 'body'),
        simulation: true,
        environmentId: this.environmentId,
        runId: effect.runId,
        assignmentId: effect.assignmentId,
      },
    });
    return { id, issueId: issue.id, simulation: true };
  }

  /** Closes an observed issue revision; stale writes fail without a provider receipt. */
  private close(effect: ExternalEffect): Record<string, unknown> {
    const issue = this.store.resource(this.text(effect, 'issueId'));
    if (issue.kind !== 'issue' || issue.data.environmentId !== this.environmentId)
      throw new Error('Issue belongs to a different environment');
    const revision = effect.input.revision;
    if (!Number.isSafeInteger(revision)) throw new Error('Expected issue revision');
    const updated = this.store.update(issue.id, revision as number, { state: 'closed' });
    return { id: updated.id, revision: updated.revision, simulation: true };
  }

  /** Validates required content without accepting absent values as strings. */
  private text(effect: ExternalEffect, key: string): string {
    const value = effect.input[key];
    if (typeof value !== 'string' || !value.trim()) throw new Error('Missing ' + key);
    return value;
  }

  /** Rejects cross-environment and real-target requests before accessing provider state. */
  private assert(effect: ExternalEffect): void {
    if (effect.environmentId !== this.environmentId || effect.target !== this.target)
      throw new Error('Simulated provider environment or target mismatch');
  }
}
