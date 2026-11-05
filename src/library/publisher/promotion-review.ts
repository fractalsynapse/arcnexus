import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { executionIdentity, type ProjectExecution } from '../architecture/execution-context.js';
import { covered } from '../architecture/components.js';
import type { ExecutionRun, ExecutionAssignment } from '../coordination-store/execution-types.js';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { RecordData } from '../workspace/state.js';
import { git } from '../operations/process.js';
import { Direction } from '../task-intake/direction.js';
import { candidateDigest } from '../change-inspection/changes.js';
import type { SimulationCheckResult } from '../operations/simulated-pull-requests.js';
import { DeliveryChecks } from './delivery-checks.js';

/** Repeats target checks and independent goal review without relabeling simulated engineering as live work. */
export class PromotionReview {
  /** Captures current target authority and the original accountable assignments as provenance only. */
  constructor(
    private readonly root: string,
    private readonly context: ProjectExecution,
    private readonly source: DeliveryRecord,
    private readonly run: ExecutionRun,
    private readonly assignments: ExecutionAssignment[],
  ) {}

  /** Accepts only fresh observed verification of the reconciled target candidate. */
  async verify(head: string, signal: AbortSignal) {
    this.authority(head);
    const checks = await new DeliveryChecks(
      this.root,
      this.context,
      this.run,
      this.assignments,
    ).check(head, signal, true);
    if (checks.status !== 'passed' || checks.evidence.length < 2)
      throw new Error('Promotion requires current target checks and independent acceptance');
    const record = JSON.parse(readFileSync(checks.evidence[0]!, 'utf8')) as RecordData;
    const goal = await this.assess(record, checks, signal);
    const references = [...checks.evidence, ...goal];
    return {
      record,
      goalEvidence: goal,
      verification: {
        references,
        digest: createHash('sha256')
          .update(JSON.stringify(references.map((path) => JSON.parse(readFileSync(path, 'utf8')))))
          .digest('hex'),
      },
    };
  }

  /** Assesses the original goal with current evidence while retaining simulation provenance explicitly. */
  private async assess(record: RecordData, checks: SimulationCheckResult, signal: AbortSignal) {
    const before = candidateDigest(record);
    const goal = await new Direction(this.root, this.context, signal).verify(
      record,
      this.assignments[0]!.owner,
      this.run.objective,
      this.assignments,
      true,
      {
        run: this.run,
        promotionSource: this.source,
        originalAssignments: this.assignments,
        targetChecks: checks,
      },
      this.context.base,
    );
    signal.throwIfAborted();
    if (candidateDigest(record) !== before)
      throw new Error('Promotion review changed target source');
    return goal;
  }

  /** Refuses mode changes, missing source attribution and obsolete target ownership before running checks. */
  private authority(head: string): void {
    if (
      this.source.environment.mode !== 'simulation' ||
      this.run.environment?.mode !== 'live' ||
      this.source.runId === this.run.id ||
      this.source.environment.id === this.run.environment.id ||
      this.run.data.executionIdentity !== executionIdentity(this.context) ||
      this.run.data.authorityBase !== this.context.base ||
      this.source.packageId !== this.context.packageId ||
      !this.assignments.length ||
      this.assignments.some((a) => a.runId !== this.source.runId || a.status !== 'completed') ||
      JSON.stringify(this.assignments.map((a) => a.id)) !==
        JSON.stringify(this.source.assignmentIds)
    )
      throw new Error(
        'Promotion requires distinct live authority and original simulated attribution',
      );
    if (
      !/^[a-f0-9]{40,64}$/.test(head) ||
      git(this.context.source, 'show', '-s', '--format=%P', head).trim() !== this.context.base
    )
      throw new Error('Promotion candidate must be parented by the captured current target');
    this.ownership(head);
  }

  /** Requires every promoted path to remain within the original owners' current target permissions. */
  private ownership(head: string): void {
    const paths = git(
      this.context.source,
      'diff',
      '--name-only',
      '--no-renames',
      '-z',
      this.context.base,
      head,
      '--',
    )
      .split('\0')
      .filter(Boolean);
    if (!paths.length) throw new Error('Promotion has no target changes');
    const owners = [...new Set(this.assignments.map((a) => a.owner))];
    const components = owners.map((id) => this.context.catalog.components[id]);
    if (components.some((component) => !component || !this.context.owners.includes(component.id)))
      throw new Error('Promotion owner is not eligible under current target authority');
    for (const path of paths)
      if (
        components.filter((component) => covered(path, component!.allowedWritePaths)).length !== 1
      )
        throw new Error('Promotion path has no unique accountable target owner: ' + path);
  }
}
