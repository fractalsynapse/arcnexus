export { PublicationPolicy, type CapturedPublicationPolicy } from './publication-policy.js';

export { DeliveryChecks } from './delivery-checks.js';

import { createHash } from 'node:crypto';
import type { ExecutionRun, ExecutionAssignment } from '../coordination-store/execution-types.js';
import type { DeliveryStore } from '../coordination-store/delivery-store.js';
import type { DeliveryCapture } from '../coordination-store/delivery-types.js';
import type { RecordData } from '../workspace/state.js';
import { DeliveryVerification } from './delivery-verification.js';

/** Captures verified engineering as immutable publication input without granting upstream authority. */
export class Publisher {
  /** Retains the private evidence root and durable delivery writer owned by the supervising host. */
  constructor(
    private readonly root: string,
    private readonly store: DeliveryStore,
  ) {}

  /** Validates actual retained evidence before creating an idempotent delivery for this candidate. */
  capture(
    projectId: string,
    run: ExecutionRun,
    assignments: ExecutionAssignment[],
    target: DeliveryCapture['target'],
  ) {
    const candidate = run.data.candidateRecord as RecordData | undefined;
    if (!candidate) throw new Error('No verified candidate is available for delivery');
    const verification = new DeliveryVerification(this.root).capture(run, assignments, candidate);
    const id = createHash('sha256')
      .update(
        JSON.stringify([projectId, run.id, run.environment, run.data.candidateRevision, target]),
      )
      .digest('hex');
    return this.store.capture({
      id,
      projectId,
      runId: run.id,
      packageId: String(run.data.packageId ?? ''),
      assignmentIds: assignments.map((assignment) => assignment.id),
      environment: run.environment!,
      authorityDigest: String(run.data.executionIdentity ?? ''),
      base: String(run.data.authorityBase ?? ''),
      candidate: String(run.data.candidateRevision ?? ''),
      verification,
      target,
    });
  }
}

export {
  SimulationPublication,
  type SimulationPublicationContext,
} from './simulation-publication.js';

export { DeliveryResources } from './delivery-resources.js';

export { LivePublication, type LivePublicationContext } from './live-publication.js';
