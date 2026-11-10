import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type { RecordData } from '../workspace/state.js';
import type { ExecutionRun, ExecutionAssignment } from '../coordination-store/execution-types.js';

const summaryFields = [
  'prompt',
  'questions',
  'stewardshipReviews',
  'architectureProposal',
  'error',
  'integrityError',
  'pauseReason',
  'authorityBase',
  'authorityError',
  'executionIdentity',
  'candidateRevision',
  'verifiedEvidence',
  'goalEvidence',
  'recoveryProposal',
  'dependencyCleanup',
  'storageError',
];

/** Projects durable runs into compact CLI progress and inspectable reports without changing authority. */
export class ExecutionReports {
  /** Uses the same authoritative store while retaining projections beneath its project directory. */
  constructor(
    private readonly directory: string,
    private readonly store: ExecutionStore,
  ) {}

  /** Produces lifecycle, accountable work, blockers, inbox counts and verified candidate evidence. */
  view(id: string) {
    const run = this.store.run(id);
    const required = new Set(this.store.requiredAssignments(id).map((a) => a.id));
    const assignments = this.store.assignments(id).map((a) => this.assignment(a, required));
    const escalations = assignments.flatMap((assignment) => assignment.escalations ?? []);
    return {
      run: this.summary(run),
      assignments,
      counts: {
        ready: assignments.filter((a) => a.required && a.status === 'ready').length,
        waiting: assignments.filter((a) => a.required && a.status === 'waiting').length,
        verified: assignments.filter((a) => a.status === 'completed').length,
        ...(escalations.length
          ? {
              outstandingEscalations: escalations.filter((item) => item.status === 'outstanding')
                .length,
              resolvedEscalations: escalations.filter((item) => item.status === 'resolved').length,
            }
          : {}),
      },
      report: join(this.directory, 'reports', id + '.json'),
    };
  }

  /** Keeps historical status visible while distinguishing current obligations from disconnected work. */
  private assignment(a: ExecutionAssignment, required: Set<string>) {
    const escalations = this.escalations(a);

    return {
      id: a.id,
      required: required.has(a.id),
      owner: a.owner,
      objective: a.objective,
      status: a.status,
      replaces: a.data.replaces,
      replacedBy: a.data.replacedBy,
      replacementReason: a.data.replacementReason,
      dependencies: a.dependencies,
      evidence: a.evidence,
      reason: a.data.reason,
      recordId: a.data.recordId,
      evidenceRetention: this.expiration(a.data.recordId),
      reconciliation: a.data.reconciliation,
      progress: a.status === 'running' ? this.progress(a.data.recordId) : undefined,
      inbox: this.store.inbox(a.id).length,
      ...(escalations.length ? { escalations } : {}),
    };
  }

  /** Lists one assignment's escalation history with explicit outstanding and resolved states. */
  private escalations(assignment: ExecutionAssignment) {
    return this.store.escalations
      .forAssignment(assignment)
      .filter((item) => item.runId === assignment.runId)
      .map((item) => ({
        id: item.id,
        assignmentId: item.assignmentId,
        owner: item.owner,
        status: item.closedAt ? 'resolved' : 'outstanding',
        reason: item.reason,
        openStepCount: item.openSteps.length,
        ...(item.closedAt ? { resolution: item.resolution ?? 'unavailable' } : {}),
      }));
  }

  /** Reads host-observed stage and completed command evidence without exposing private model reasoning. */
  private progress(id: unknown) {
    if (typeof id !== 'string') return undefined;
    const path = join(this.directory, '..', '..', 'runs', id, 'report.json');
    try {
      const record = JSON.parse(readFileSync(path, 'utf8')) as RecordData;
      const latest = record.commands.at(-1);
      return {
        stage: record.stage,
        status: record.status,
        report: path,
        completedCommands: record.commands.length,
        latestCommand: latest
          ? { command: latest.command, exitCode: latest.exitCode, log: latest.log }
          : undefined,
      };
    } catch {
      return { report: path, status: 'evidence_unavailable' };
    }
  }

  /** Retains a regenerable projection after a checkpoint; SQLite and raw harness evidence stay authoritative. */
  save(id: string): void {
    const report = this.view(id);
    mkdirSync(join(this.directory, 'reports'), { recursive: true, mode: 0o700 });
    writeFileSync(report.report + '.tmp', JSON.stringify(report, null, 2), { mode: 0o600 });
    renameSync(report.report + '.tmp', report.report);
  }

  /** Omits large captured catalogs from streaming output while preserving actionable questions and evidence. */
  private summary(run: ExecutionRun) {
    const candidate = run.data.candidateRecord as { workspace?: string } | undefined;
    return {
      id: run.id,
      mode: run.mode,
      environment: run.environment,
      objective: run.objective,
      status: run.status,
      createdAt: run.createdAt,
      data: {
        ...Object.fromEntries(summaryFields.map((key) => [key, run.data[key]])),
        candidateLocation: candidate?.workspace,
        evidenceRetention: this.expiration((run.data.workspace as RecordData | undefined)?.id),
      },
    };
  }

  /** Distinguishes deliberate historical expiration from evidence that disappeared unexpectedly. */
  private expiration(id: unknown) {
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) return undefined;
    const path = join(this.directory, '..', '..', 'expired-evidence', id + '.json');
    if (!existsSync(path)) return undefined;
    const receipt = JSON.parse(readFileSync(path, 'utf8'));
    return { status: receipt.status, expiredAt: receipt.expiredAt, receipt: path };
  }
}
