import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { git } from '../operations/process.js';
import { executionIdentity } from '../architecture/execution-context.js';
import { AssemblyAcceptance } from './assembly-acceptance.js';
import { PublicationEvidence } from '../report/report.js';
import { PublicationPolicy } from './publication-policy.js';
import { join } from 'node:path';
import type { ProjectExecution } from '../architecture/execution-context.js';
import type { ExecutionRun, ExecutionAssignment } from '../coordination-store/execution-types.js';
import { OperationExecution } from '../operations/operation-execution.js';
import type { SimulationCheckResult } from '../operations/simulated-pull-requests.js';
import { createWorkspace, prepareWorkspace } from '../workspace/workspace.js';
import { save, type RecordData } from '../workspace/state.js';
import { Direction } from '../task-intake/direction.js';
import { candidateDigest } from '../change-inspection/changes.js';

/** The single accepted verdict for one candidate: its inputs, reviewer coverage and evidence. */
export interface VerificationVerdict {
  key: string;
  digest: string;
  independent: boolean;
  result: SimulationCheckResult;
}

/** The facts a recorded verdict must still agree with before it can be read instead of re-checked. */
export interface VerdictAgreement {
  key: string;
  digest: string;
  independent: boolean;
  completed: boolean;
  sameRun: boolean;
  workspacePresent: boolean;
  evidencePresent: boolean;
  artifactsPresent: boolean;
}

/**
 * Reports whether a recorded verdict still describes exactly this candidate.
 *
 * A verdict is content-addressed to the candidate digest and the captured input key. Any change to
 * source bytes, captured authority, environment, goal or accountable acceptance produces a different
 * key; a missing workspace, evidence or artifact invalidates it. This is the only reuse rule in the
 * acceptance path: there is no second gate and no mitigation cache beside it.
 */
export function verdictAgrees(
  verdict: VerificationVerdict | undefined,
  agreement: VerdictAgreement,
): boolean {
  if (!verdict) return false;
  return (
    verdict.key === agreement.key &&
    verdict.digest === agreement.digest &&
    (!agreement.independent || verdict.independent) &&
    agreement.completed &&
    agreement.sameRun &&
    agreement.workspacePresent &&
    agreement.evidencePresent &&
    agreement.artifactsPresent
  );
}

/** Runs captured publication checks on a fresh isolated head through the shared confined operation executor. */
export class DeliveryChecks {
  /** Retains actual owner assignments and captured architecture instead of accepting caller-authored checks. */
  constructor(
    private readonly root: string,
    private readonly context: ProjectExecution,
    private readonly run: ExecutionRun,
    private readonly assignments: ExecutionAssignment[],
  ) {}

  /** Produces the one verdict for a candidate, reusing the recorded verdict instead of re-checking. */
  async check(
    head: string,
    signal: AbortSignal,
    independent = false,
  ): Promise<SimulationCheckResult> {
    if (!/^[a-f0-9]{40,64}$/.test(head)) throw new Error('Expected immutable delivery head');
    signal.throwIfAborted();
    return (
      this.verdict(head, independent)?.result ??
      this.checkRecord(this.record(head), signal, independent)
    );
  }

  /**
   * Returns the verdict recorded for exactly this candidate, or nothing.
   *
   * A verdict is content-addressed to the candidate digest and the captured input key, and is valid
   * only while its evidence still exists. An invalid or absent verdict is reported as such rather
   * than quietly re-running a gate that already happened.
   */
  verdict(head: string, independent = false): VerificationVerdict | undefined {
    const record = this.candidate();
    const verdict = record?.verdict as VerificationVerdict | undefined;
    if (!record || !verdict || !this.valid(record, verdict, head, independent)) return undefined;
    return structuredClone(verdict);
  }

  /** Assembles the facts a recorded verdict must agree with for this candidate. */
  private valid(
    record: RecordData,
    verdict: VerificationVerdict,
    head: string,
    independent: boolean,
  ): boolean {
    return verdictAgrees(verdict, {
      key: this.key(head),
      digest: candidateDigest(record),
      independent,
      completed: record.status === 'completed',
      sameRun: record.executionRunId === this.run.id,
      workspacePresent: existsSync(record.workspace),
      evidencePresent: !verdict.result.evidence.some((path) => !existsSync(path)),
      artifactsPresent: !verdict.result.artifacts.some((artifact) => !existsSync(artifact.path)),
    });
  }

  /** The candidate record this run's verdict belongs to. */
  private candidate(): RecordData | undefined {
    return this.run.data?.candidateRecord as RecordData | undefined;
  }

  /** Checks a journaled candidate through the same acceptance path used by ordinary publication. */
  async checkRecord(
    record: RecordData,
    signal: AbortSignal,
    independent = false,
    contributions: RecordData[] = [],
  ): Promise<SimulationCheckResult> {
    const evidence = [join(this.root, 'runs', record.id, 'report.json')];
    try {
      await prepareWorkspace(this.root, record, signal);
      await this.verify(record, signal);
      await new AssemblyAcceptance(this.root, record, signal).verify(
        contributions,
        String(record.assemblyBase ?? record.base),
      );
      save(this.root, record);
      if (independent) evidence.push(...(await this.review(record, signal)));
      return this.accept(record, evidence, independent);
    } catch (error) {
      record.error = String(error);
      record.status = signal.aborted ? 'interrupted' : 'failed';
      if (!this.observedFailure(record) || signal.aborted) throw error;
      return { status: 'failed', evidence, artifacts: [] };
    } finally {
      save(this.root, record);
    }
  }

  /** Records the one verdict for these bytes so every later step reads it instead of re-checking. */
  private accept(
    record: RecordData,
    evidence: string[],
    independent: boolean,
  ): SimulationCheckResult {
    record.status = 'completed';
    const result: SimulationCheckResult = {
      status: 'passed',
      evidence,
      artifacts: this.artifacts(record),
    };
    record.verdict = {
      key: this.key(record.base),
      independent,
      digest: candidateDigest(record),
      result,
    } satisfies VerificationVerdict;
    return result;
  }

  /** Binds reuse to source content, captured authority, environment, goal and accountable acceptance criteria. */
  private key(head: string): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          tree: git(this.context.source, 'rev-parse', head + '^{tree}').trim(),
          authority: executionIdentity(this.context),
          environment: this.run.environment,
          objective: this.run.objective,
          assignments: this.assignments
            .map(({ id, owner, objective, acceptance }) => ({ id, owner, objective, acceptance }))
            .sort((a, b) => String(a.id).localeCompare(String(b.id))),
        }),
      )
      .digest('hex');
  }

  /** Captures preparation authority before any command, preserving immutable environment identity. */
  record(head: string): RecordData {
    const record = createWorkspace(this.root, {
      project: this.context.source,
      base: head,
      authorityBase: this.context.base,
      packageId: this.context.packageId,
      bindings: this.context.bindings,
    });
    record.executionRunId = this.run.id;
    record.executionEnvironment = this.run.environment;
    record.activationRole = 'publication-checks';
    save(this.root, record);
    return record;
  }

  /** Repeats required checks for every accountable owner, deduplicating only through the shared checkpoint. */
  private async verify(record: RecordData, signal: AbortSignal): Promise<void> {
    const publisher = new PublicationPolicy().resolve(this.context)?.owner;
    const owners = [
      ...new Set([
        ...this.assignments.map((assignment) => assignment.owner),
        ...(publisher ? [publisher] : []),
      ]),
    ];
    if (!this.assignments.length)
      throw new Error('Publication requires accountable verified assignments');
    const operations = owners.flatMap((id) => {
      const component = this.context.catalog.components[id];
      if (
        !component ||
        !this.context.owners.includes(id) ||
        !component.operationPlan?.verify?.length
      )
        throw new Error('Missing captured owner verification: ' + id);
      return [...component.operationPlan.verify, ...(component.operationPlan.delivery ?? [])];
    });
    const before = candidateDigest(record);
    record.commands.push(
      ...(await new OperationExecution(this.root, record, signal).checkpoint(
        operations,
        'publication-verify',
      )),
    );
    if (candidateDigest(record) !== before)
      throw new Error('Publication check changed maintained source');
  }

  /** Independently assesses assembled changes against captured source and original assignment criteria. */
  private review(record: RecordData, signal: AbortSignal): Promise<string[]> {
    const evidence = {
      stage:
        'Assembled candidate before integration. Assess the engineering criteria using publication.head and its observed checks. Integration and release outcomes are recorded separately after verification.',
      criteria: this.assignments.flatMap((assignment) => assignment.acceptance),
      assignments: this.assignments,
      commands: record.commands,
    };
    return new Direction(
      this.root,
      this.context,
      signal,
      new PublicationEvidence(this.root, this.context.key).capture(
        this.run,
        record,
        this.assignments,
      ),
    ).verify(
      record,
      this.assignments[0]!.owner,
      this.run.objective,
      evidence,
      this.run.mode === 'task',
      String(record.assemblyBase ?? this.context.base),
    );
  }

  /** Counts an observed failed command as a check failure while preserving uncertain execution for recovery. */
  private observedFailure(record: RecordData): boolean {
    const invocations = (record.operationInvocations ?? []) as Array<{ status: string }>;
    return (
      invocations.some((invocation) => invocation.status === 'failed') &&
      !invocations.some((invocation) =>
        ['running', 'interrupted', 'cancelled'].includes(invocation.status),
      )
    );
  }

  /** Projects immutable copies captured by shared operations rather than mutable generated output paths. */
  private artifacts(record: RecordData): SimulationCheckResult['artifacts'] {
    const invocations = (record.operationInvocations ?? []) as Array<{
      status: string;
      artifacts: Array<{ artifact: string; sha256: string }>;
    }>;
    return invocations
      .filter((invocation) => invocation.status === 'completed')
      .flatMap((invocation) =>
        invocation.artifacts.map((artifact) => ({
          path: join(this.root, 'runs', record.id, artifact.artifact),
          sha256: artifact.sha256,
        })),
      );
  }
}
