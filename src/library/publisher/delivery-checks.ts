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

/** Runs captured publication checks on a fresh isolated head through the shared confined operation executor. */
export class DeliveryChecks {
  /** Retains actual owner assignments and captured architecture instead of accepting caller-authored checks. */
  constructor(
    private readonly root: string,
    private readonly context: ProjectExecution,
    private readonly run: ExecutionRun,
    private readonly assignments: ExecutionAssignment[],
  ) {}

  /** Preserves actual invocation evidence and distinguishes observed check failures from interruption. */
  async check(
    head: string,
    signal: AbortSignal,
    independent = false,
  ): Promise<SimulationCheckResult> {
    if (!/^[a-f0-9]{40,64}$/.test(head)) throw new Error('Expected immutable delivery head');
    signal.throwIfAborted();
    return (
      this.retained(head, independent) ?? this.checkRecord(this.record(head), signal, independent)
    );
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

  /** Retains one completed acceptance receipt so publication can reuse the exact checked inputs. */
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
    record.acceptedChecks = {
      key: this.key(record.base),
      independent,
      digest: candidateDigest(record),
      result,
    };
    return result;
  }

  /** Reuses accepted bytes and criteria in this run; changed trees, authority or missing evidence require checks. */
  private retained(head: string, independent: boolean): SimulationCheckResult | undefined {
    const record = this.run.data?.candidateRecord as RecordData | undefined;
    const accepted = record?.acceptedChecks as
      | {
          key: string;
          independent: boolean;
          digest: string;
          result: SimulationCheckResult;
        }
      | undefined;
    if (
      !record ||
      !accepted ||
      record.status !== 'completed' ||
      record.executionRunId !== this.run.id ||
      accepted.key !== this.key(head) ||
      (independent && !accepted.independent) ||
      !existsSync(record.workspace) ||
      accepted.digest !== candidateDigest(record) ||
      accepted.result.evidence.some((path) => !existsSync(path)) ||
      accepted.result.artifacts.some((artifact) => !existsSync(artifact.path))
    )
      return undefined;
    return structuredClone(accepted.result);
  }

  /** Binds reuse to source content, captured authority, environment, goal and accountable acceptance criteria. */
  private key(head: string): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          tree: git(this.context.source, 'rev-parse', head + '^{tree}').trim(),
          authority: executionIdentity(this.context),
          environment: this.run.environment,
          objective: this.run.data?.promotionSourceObjective ?? this.run.objective,
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
      new PublicationEvidence(this.root, this.context.key).capture(this.run, record),
    ).verify(
      record,
      this.assignments[0]!.owner,
      String(this.run.data.promotionSourceObjective ?? this.run.objective),
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
