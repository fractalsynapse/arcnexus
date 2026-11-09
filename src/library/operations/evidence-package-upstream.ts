import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import type { UpstreamProvider } from './upstream-execution.js';

interface PackageRecord {
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
    appendFileSync(this.packagePath, JSON.stringify(record) + '\n');
    return result;
  }

  /** Reads back what was already captured, so recovery after host loss sees a completed operation. */
  async inspect(effect: ExternalEffect, signal: AbortSignal): Promise<ExternalObservation> {
    signal.throwIfAborted();
    this.bind(effect);
    const record = this.find(effect.id);
    if (!record) return { status: 'absent', evidence: this.packagePath };
    return { status: 'completed', evidence: this.packagePath, result: record.result };
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

  /** Issues, comments and closures are recorded with their real text; anything else is a gap. */
  private capture(effect: ExternalEffect): Record<string, unknown> {
    const payload = effect.input as Record<string, unknown>;
    if (effect.operation === 'issue.create') {
      const id = `${this.environmentId}:issue:${effect.id}`;
      return { id, issueId: id, revision: 1, provider: 'evidence-package', simulation: true };
    }
    if (effect.operation === 'issue.comment') {
      const id = `${this.environmentId}:comment:${effect.id}`;
      return {
        id,
        issueId: String(payload.issueId ?? ''),
        revision: 1,
        provider: 'evidence-package',
        simulation: true,
      };
    }
    if (effect.operation === 'issue.close')
      return {
        id: String(payload.issueId ?? ''),
        revision: 2,
        state: 'closed',
        provider: 'evidence-package',
      };
    throw new Error('Unsupported evidence-package operation: ' + effect.operation);
  }

  /** Locates the effect already captured, so a replay reuses its receipt. */
  private find(effectId: string): PackageRecord | undefined {
    return this.records().find((record) => record.effectId === effectId);
  }

  /** Reads the append-only package; a missing file is simply an empty history. */
  private records(): PackageRecord[] {
    if (!existsSync(this.packagePath)) return [];
    return readFileSync(this.packagePath, 'utf8')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as PackageRecord);
  }
}

/** Addresses captured intent so a later reader can tell exactly what was recorded. */
function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
