import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ProjectExecution } from '../architecture/execution-context.js';
import { candidateDigest } from '../change-inspection/changes.js';
import { completePlan } from '../assignment/plan.js';
import { validateCheckpoint } from '../assignment/steward.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type {
  ExecutionAssignment,
  ExecutionRun,
  PreparedContribution,
} from '../coordination-store/execution-types.js';
import { DeliveryChecks } from '../publisher/publisher.js';
import { save, type RecordData } from '../workspace/state.js';
import { VerificationIssue } from '../task-intake/direction.js';
import { VerificationBaseline } from './verification-baseline.js';
import { ContributionSnapshots } from './contribution-snapshots.js';

interface PendingAssembly {
  base: string;
  head: string;
  recordId: string;
  assignments: string[];
  contributions: PreparedContribution[];
}

/** Advances dependent source through existing delivery checks and one atomic candidate promotion. */
export class AssembledDelivery {
  /** Shares the active repository lane, captured authority and ordinary durable store. */
  constructor(
    private readonly root: string,
    private readonly context: ProjectExecution,
    private readonly store: ExecutionStore,
  ) {}

  /** Reconciles durable preparation before invoking checks; uncertain operations are never replayed. */
  async advance(run: ExecutionRun, signal: AbortSignal): Promise<boolean> {
    const pending = (run.data.pendingAssembly as PendingAssembly | undefined) ?? this.prepare(run);
    if (!pending) return false;
    const record = this.record(pending.recordId);
    if (record.assemblyEvidence && record.status === 'completed') {
      this.complete(run, pending, record);
      return true;
    }
    const assignments = pending.assignments.map((id) => this.store.assignment(id));
    const records = assignments.map((item, index) =>
      this.contribution(item, pending.contributions[index]!),
    );
    if (record.assemblyStarted)
      throw new Error('Assembly was interrupted; inspect retained checks before continuation');
    await this.verify(run, pending, record, assignments, records, signal);
    return true;
  }

  /** Routes observed deficiencies to ordinary director correction while preserving uncertain effects. */
  private async verify(
    run: ExecutionRun,
    pending: PendingAssembly,
    record: RecordData,
    assignments: ExecutionAssignment[],
    records: RecordData[],
    signal: AbortSignal,
  ): Promise<void> {
    record.assemblyStarted = true;
    save(this.root, record);
    try {
      const result = await new DeliveryChecks(
        this.root,
        this.context,
        run,
        assignments,
      ).checkRecord(record, signal, true, records);
      if (result.status !== 'passed') {
        this.reject(run, pending, 'Assembled checks failed: ' + result.evidence.join(', '));
        return;
      }
      record.assemblyEvidence = result.evidence.slice(1);
      record.assemblyDigest = candidateDigest(record);
      save(this.root, record);
      this.complete(run, pending, record);
    } catch (error) {
      if (!(error instanceof VerificationIssue)) throw error;
      this.reject(run, pending, error.result);
    }
  }

  /** Preserves the failed assembly and lets the existing director choose which contributions need repair. */
  private reject(run: ExecutionRun, pending: PendingAssembly, finding: unknown): void {
    const record = this.record(pending.recordId);
    record.assemblyFindings = finding;
    save(this.root, record);
    const reason = typeof finding === 'string' ? finding : JSON.stringify(finding);
    for (const id of pending.assignments)
      this.store.fail(id, 'failed', `Assembly ${pending.recordId}: ${reason}`);
    this.store.updateRun(run.id, this.store.run(run.id).status, {
      pendingAssembly: null,
      lastAssembly: { ...pending, reason },
    });
  }

  /** Journals exact contributions before setup or model operations can produce uncertain side effects. */
  private prepare(run: ExecutionRun): PendingAssembly | undefined {
    const group = this.store.contributionGroups(run.id).ready()[0];
    if (!group) return undefined;
    const contributions = group.map((item) => item.data.contribution as PreparedContribution);
    group.forEach((item, index) => this.contribution(item, contributions[index]!));
    const base = String(run.data.candidateRevision ?? this.context.base);
    const head = new ContributionSnapshots(this.root, this.context).assemble(base, group);
    const record = new DeliveryChecks(this.root, this.context, run, group).record(head);
    record.assemblyBase = base;
    const baseline: RecordData = { ...record, base };
    new VerificationBaseline(this.context).capture(baseline);
    record.verifiedTestPaths = baseline.verifiedTestPaths;
    record.assemblyAssignments = group.map((item) => ({
      id: item.id,
      owner: item.owner,
      recordId: item.data.recordId,
      contribution: item.data.contribution,
      acceptance: item.acceptance,
    }));
    save(this.root, record);
    const pending = {
      base,
      head,
      recordId: record.id,
      assignments: group.map((item) => item.id),
      contributions,
    };
    this.store.updateRun(run.id, run.status, { pendingAssembly: pending });
    return pending;
  }

  /** Verifies that a prepared snapshot still belongs to the settled owner checkpoint being assembled. */
  private contribution(item: ExecutionAssignment, contribution: PreparedContribution): RecordData {
    if (
      item.status !== 'prepared' ||
      JSON.stringify(item.data.contribution) !== JSON.stringify(contribution)
    )
      throw new Error('Prepared contribution changed before assembly');
    const record = this.record(contribution.recordId);
    const authority = record.resolvedAssignment as {
      base?: string;
      context?: Array<{ id: string }>;
    };
    if (
      record.source !== this.context.source ||
      authority.base !== this.context.base ||
      authority.context?.at(-1)?.id !== item.owner ||
      record.assignmentId !== item.id ||
      record.executionRunId !== item.runId ||
      record.base !== contribution.base ||
      (record.checkpoint as { sha256?: string } | undefined)?.sha256 !== contribution.checkpoint
    )
      throw new Error('Prepared checkpoint identity does not match its contribution');
    validateCheckpoint(this.root, record, 'retain');
    return record;
  }

  /** Publishes the combined acceptance once, preserving every original owner record and branch. */
  private complete(run: ExecutionRun, pending: PendingAssembly, record: RecordData): void {
    if (
      record.base !== pending.head ||
      record.executionRunId !== run.id ||
      record.assemblyDigest !== candidateDigest(record)
    )
      throw new Error('Assembled candidate changed after verification');
    const evidence = record.assemblyEvidence as string[];
    this.store.completeAssembly(
      pending.assignments,
      evidence,
      {
        candidateRevision: pending.head,
        candidateRecord: record,
        verifiedEvidence: evidence,
        assemblyBase: pending.base,
      },
      pending.contributions,
    );
    for (const contribution of pending.contributions) {
      const source = this.record(contribution.recordId);
      if (source.deliveryRecordId === record.id && source.status === 'completed') continue;
      source.status = 'completed';
      source.outcome = 'verified_in_assembly';
      source.deliveryRecordId = record.id;
      completePlan(this.root, source, evidence);
      save(this.root, source);
    }
    this.store.updateRun(run.id, this.store.run(run.id).status, { pendingAssembly: null });
  }

  /** Resolves private records without allowing identities or filesystem aliases to escape retained state. */
  private record(id: string): RecordData {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid assembly record identity');
    const path = resolve(this.root, 'runs', id, 'report.json');
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.nlink !== 1 || realpathSync(path) !== path)
      throw new Error('Unsafe assembly record alias');
    const record = JSON.parse(readFileSync(path, 'utf8')) as RecordData;
    if (record.id !== id) throw new Error('Assembly record identity changed');
    return record;
  }
}
