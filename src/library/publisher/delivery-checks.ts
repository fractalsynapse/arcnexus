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
    const record = this.record(head);
    const evidence = [join(this.root, 'runs', record.id, 'report.json')];
    try {
      await prepareWorkspace(this.root, record, signal);
      await this.verify(record, signal);
      if (independent) evidence.push(...(await this.review(record, signal)));
      record.status = 'completed';
      return { status: 'passed', evidence, artifacts: this.artifacts(record) };
    } catch (error) {
      record.error = String(error);
      record.status = signal.aborted ? 'interrupted' : 'failed';
      if (!this.observedFailure(record) || signal.aborted) throw error;
      return { status: 'failed', evidence, artifacts: [] };
    } finally {
      save(this.root, record);
    }
  }

  /** Captures preparation authority before any command, preserving immutable environment identity. */
  private record(head: string): RecordData {
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
      criteria: this.assignments.flatMap((assignment) => assignment.acceptance),
      assignments: this.assignments,
      commands: record.commands,
    };
    return new Direction(this.root, this.context, signal).verify(
      record,
      this.assignments[0]!.owner,
      this.run.objective,
      evidence,
      false,
      undefined,
      this.context.base,
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
