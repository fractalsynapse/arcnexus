export { PublicationPolicy, type CapturedPublicationPolicy } from './publication-policy.js';

export {
  DeliveryChecks,
  verdictAgrees,
  type VerdictAgreement,
  type VerificationVerdict,
} from './delivery-checks.js';

import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecutionRun, ExecutionAssignment } from '../coordination-store/execution-types.js';
import type { DeliveryStore } from '../coordination-store/delivery-store.js';
import type { DeliveryCapture, DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { RecordData } from '../workspace/state.js';
import { DeliveryVerification } from './delivery-verification.js';
import { DevelopmentDeliveries } from './development-deliveries.js';
import { deliveryDocument } from './delivery-document.js';

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
    const revision = String(run.data.candidateRevision ?? '');
    const id = this.identity(projectId, run, revision, target);
    return this.store.capture({
      id,
      projectId,
      runId: run.id,
      packageId: String(run.data.packageId ?? ''),
      assignmentIds: assignments.map((assignment) => assignment.id),
      environment: run.environment!,
      authorityDigest: String(run.data.executionIdentity ?? ''),
      base: this.engineeringBase(candidate),
      candidate: revision,
      candidateRecordId: candidate.id,
      verification,
      publicationDocument: this.document(id, run, assignments, candidate, verification, revision),
      target,
      developments: new DevelopmentDeliveries(this.root).capture(assignments, candidate, revision),
    });
  }

  /** Retains existing publication intent during recovery; new deliveries capture the current readable format. */
  private document(
    id: string,
    run: ExecutionRun,
    assignments: ExecutionAssignment[],
    candidate: RecordData,
    verification: DeliveryCapture['verification'],
    head: string,
  ) {
    const retained = this.store.list().find((delivery) => delivery.id === id);
    return retained
      ? retained.publicationDocument
      : deliveryDocument(run, assignments, candidate, verification, head);
  }

  /** Rechecks original delivery proof without trusting a workday's later candidate pointer or revised review claims. */
  revalidate(
    delivery: DeliveryRecord,
    run: ExecutionRun,
    assignments: ExecutionAssignment[],
    candidate: RecordData,
  ): void {
    this.assertRetained(delivery, run, assignments, candidate);
    const captured = { ...run, data: { ...run.data, candidateRevision: delivery.candidate } };
    const evidence = new DeliveryVerification(this.root).capture(captured, assignments, candidate);
    if (
      delivery.developments &&
      JSON.stringify(delivery.developments) !==
        JSON.stringify(
          new DevelopmentDeliveries(this.root).capture(assignments, candidate, delivery.candidate),
        )
    )
      throw new Error('Retained development manifest differs from verified assignment records');
    if (
      evidence.digest !== delivery.verification.digest ||
      JSON.stringify(evidence.references) !== JSON.stringify(delivery.verification.references)
    )
      throw new Error('Retained independent delivery evidence changed');
  }

  /** Finds the original reviewed receipt without substituting a run's newer accumulated candidate. */
  resolveRetained(
    delivery: DeliveryRecord,
    run: ExecutionRun,
    assignments: ExecutionAssignment[],
  ): RecordData {
    const ids = delivery.candidateRecordId
      ? [delivery.candidateRecordId]
      : [...new Set(assignments.map((assignment) => assignment.data.recordId))].reverse();
    const problems: string[] = [];
    for (const id of ids) {
      try {
        const candidate = this.readCandidate(id);
        this.revalidate(delivery, run, assignments, candidate);
        return candidate;
      } catch (error) {
        problems.push(String(error));
      }
    }
    throw new Error('Retained delivery candidate unavailable: ' + problems.join('; '));
  }

  /** Reads only regular private receipts with matching identities; aliases cannot redirect proof lookup. */
  private readCandidate(id: unknown): RecordData {
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
      throw new Error('Invalid retained candidate identity');
    const root = realpathSync(this.root);
    const path = join(root, 'runs', id, 'report.json');
    if (realpathSync(path) !== path || !lstatSync(path).isFile() || lstatSync(path).nlink !== 1)
      throw new Error('Unsafe retained candidate receipt');
    const candidate = JSON.parse(readFileSync(path, 'utf8')) as RecordData;
    if (candidate.id !== id) throw new Error('Retained candidate receipt identity mismatch');
    return candidate;
  }

  /** Keeps source identity, assignment attribution and captured authority separate from future target verification. */
  private assertRetained(
    delivery: DeliveryRecord,
    run: ExecutionRun,
    assignments: ExecutionAssignment[],
    candidate: RecordData,
  ): void {
    const id = this.identity(delivery.projectId, run, delivery.candidate, delivery.target);
    if (
      delivery.engineering !== 'verified' ||
      delivery.id !== id ||
      delivery.runId !== run.id ||
      JSON.stringify(delivery.environment) !== JSON.stringify(run.environment) ||
      delivery.packageId !== run.data.packageId ||
      delivery.authorityDigest !== run.data.executionIdentity ||
      delivery.base !== this.engineeringBase(candidate) ||
      JSON.stringify(delivery.assignmentIds) !== JSON.stringify(assignments.map((a) => a.id)) ||
      (delivery.candidateRecordId !== undefined && delivery.candidateRecordId !== candidate.id)
    )
      throw new Error('Retained delivery attribution differs from its captured source');
  }

  /** Uses the original engineering parent, not the checkout used to verify an assembled tree. */
  private engineeringBase(candidate: RecordData): string {
    const base = Array.isArray(candidate.assemblyAssignments)
      ? candidate.assemblyBase
      : candidate.base;
    if (typeof base !== 'string' || !base) throw new Error('Missing retained engineering baseline');
    return base;
  }

  /** Hashes one immutable attribution tuple for both initial capture and retained-proof validation. */
  private identity(
    projectId: string,
    run: ExecutionRun,
    candidate: string,
    target: DeliveryCapture['target'],
  ): string {
    return createHash('sha256')
      .update(JSON.stringify([projectId, run.id, run.environment, candidate, target]))
      .digest('hex');
  }
}

export {
  SimulationPublication,
  type SimulationPublicationContext,
} from './simulation-publication.js';

export { DeliveryResources } from './delivery-resources.js';

export { DevelopmentDeliveries } from './development-deliveries.js';

export { LivePublication, type LivePublicationContext } from './live-publication.js';
