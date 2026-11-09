import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import type { UpstreamProvider } from './upstream-execution.js';

interface PendingMarker {
  kind: 'pending';
  effectId: string;
  inputDigest: string;
  at: string;
}

interface PackageRecord {
  kind: 'captured';
  sequence: number;
  effectId: string;
  operation: string;
  runId: string;
  assignmentId?: string;
  at: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  digest: string;
}

/**
 * The simulation collaboration provider: it keeps every interaction and sends it nowhere.
 *
 * Where `GitHubUpstream` performs the four collaboration operations against a real remote, this
 * provider appends the same operations to one append-only evidence package under application
 * storage. The captured text, ordering and receipts are real records of what the run did; nothing
 * here imitates remote state, constructs an HTTP client or resolves a credential, so isolation is
 * structural rather than a refusal that could be bypassed.
 */
export class EvidencePackageUpstream implements UpstreamProvider {
  readonly mode = 'simulation' as const;

  /** Binds one package file to exactly one captured environment and target. */
  constructor(
    readonly id: string,
    private readonly environmentId: string,
    private readonly target: string,
    private readonly packagePath: string,
  ) {}

  /** Records the operation and returns the receipt the engine would have read from a remote. */
  async apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>> {
    signal.throwIfAborted();
    this.bind(effect);
    const existing = this.find(effect.id);
    if (existing) return existing.result;
    const result = this.capture(effect);
    const records = this.records();
    const record: PackageRecord = {
      kind: 'captured',
      sequence: records.length + 1,
      effectId: effect.id,
      operation: effect.operation,
      runId: effect.runId,
      ...(effect.assignmentId ? { assignmentId: effect.assignmentId } : {}),
      at: new Date().toISOString(),
      payload: structuredClone(effect.input),
      result,
      digest: digest({ operation: effect.operation, payload: effect.input, target: this.target }),
    };
    this.write(record);
    return result;
  }

  /** Reads back what was already captured, so recovery after host loss sees a completed operation. */
  async inspect(effect: ExternalEffect, signal: AbortSignal): Promise<ExternalObservation> {
    signal.throwIfAborted();
    this.bind(effect);
    const record = this.find(effect.id);
    if (record) return { status: 'completed', evidence: this.packagePath, result: record.result };
    const pending = this.pending().find((item) => item.effectId === effect.id);
    if (pending && pending.inputDigest !== effect.inputDigest)
      throw new Error('Evidence package idempotency identity conflict');
    if (pending)
      return {
        status: 'unknown',
        evidence: this.packagePath,
        reason: 'Provider work began without a captured result',
      };
    return { status: 'absent', evidence: this.packagePath };
  }

  /**
   * Journals that work began, before any result exists.
   *
   * Recovery guarantees depend on being able to say "this was attempted and its outcome is not
   * recorded" rather than "it never happened". A second attempt on an unreconciled effect is
   * refused so a caller cannot quietly double-capture.
   */
  markAttempted(effect: ExternalEffect): void {
    this.bind(effect);
    if (this.find(effect.id)) throw new Error('Evidence effect is already captured');
    if (this.pending().some((item) => item.effectId === effect.id))
      throw new Error('Evidence effect requires reconciliation before retry');
    const marker: PendingMarker = {
      kind: 'pending',
      effectId: effect.id,
      inputDigest: effect.inputDigest,
      at: new Date().toISOString(),
    };
    this.write(marker);
  }

  /** The captured operations, in the order the run performed them. */
  entries(): PackageRecord[] {
    return this.records();
  }

  /** One package belongs to exactly one captured namespace; foreign effects are refused, not merged. */
  private bind(effect: ExternalEffect): void {
    if (effect.environmentId !== this.environmentId)
      throw new Error('Evidence package is bound to another environment');
  }

  /** Dispatches only the collaboration operations this provider captures. */
  private capture(effect: ExternalEffect): Record<string, unknown> {
    if (effect.operation === 'issue.create') return this.issue(effect);
    if (effect.operation === 'issue.comment') return this.comment(effect);
    if (effect.operation === 'issue.close') return this.close(effect);
    throw new Error('Unsupported evidence-package operation: ' + effect.operation);
  }

  /** Records a tracking issue with its real title and body and the namespace that owns it. */
  private issue(effect: ExternalEffect): Record<string, unknown> {
    const id = `${this.environmentId}:issue:${effect.id}`;
    return { id, issueId: id, revision: 1, provider: 'evidence-package', simulation: true };
  }

  /** Records a comment against an issue this package already captured. */
  private comment(effect: ExternalEffect): Record<string, unknown> {
    const issue = this.requireIssue(effect.input, 'Comment');
    const id = `${this.environmentId}:comment:${effect.id}`;
    return {
      id,
      issueId: String(issue.id),
      revision: 1,
      provider: 'evidence-package',
      simulation: true,
    };
  }

  /** Closes only at the revision this package recorded, so a stale closure is rejected. */
  private close(effect: ExternalEffect): Record<string, unknown> {
    const issue = this.requireIssue(effect.input, 'Closure');
    const revision = effect.input.revision;
    if (!Number.isSafeInteger(revision)) throw new Error('Expected issue revision');
    const captured = this.records().find((entry) => entry.result.id === issue.id)!;
    if (captured.result.revision !== revision)
      throw new Error(`Stale closure: issue is at revision ${captured.result.revision}`);
    return {
      id: String(issue.id),
      revision: (revision as number) + 1,
      state: 'closed',
      provider: 'evidence-package',
    };
  }

  /**
   * Resolves the issue an operation refers to.
   *
   * A comment or closure must point at an issue this package actually recorded, so an effect
   * cannot reference state the run never created.
   */
  private requireIssue(input: Record<string, unknown>, label: string): Record<string, unknown> {
    const id = String(input.issueId ?? '');
    const record = this.records().find((entry) => entry.result.id === id);
    if (!record || record.operation !== 'issue.create')
      throw new Error(`${label} target is not an issue in this environment`);
    return record.result;
  }

  /** Locates the effect already captured, so a replay reuses its receipt. */
  private find(effectId: string): PackageRecord | undefined {
    return this.records().find((record) => record.effectId === effectId);
  }

  /** Appends one line, creating the namespace directory the first time a run collaborates. */
  private write(entry: PackageRecord | PendingMarker): void {
    mkdirSync(dirname(this.packagePath), { recursive: true });
    appendFileSync(this.packagePath, JSON.stringify(entry) + '\n');
  }

  /** Effects whose work was begun but whose result was never captured. */
  private pending(): PendingMarker[] {
    return this.lines().filter((line): line is PendingMarker => line.kind === 'pending');
  }

  /** Captured collaboration records, in the order they were written. */
  private records(): PackageRecord[] {
    return this.lines().filter((line): line is PackageRecord => line.kind === 'captured');
  }

  /** Reads the append-only package; a missing file is simply an empty history. */
  private lines(): Array<PackageRecord | PendingMarker> {
    if (!existsSync(this.packagePath)) return [];
    return readFileSync(this.packagePath, 'utf8')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as PackageRecord | PendingMarker)
      .filter((line) => line.kind === 'captured' || line.kind === 'pending');
  }
}

/** Addresses captured intent so a later reader can tell exactly what was recorded. */
function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
