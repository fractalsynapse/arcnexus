import type { DeliveryRecord, PromotionCandidate } from './delivery-types.js';
import type { ExecutionDatabase } from './execution-database.js';
import type { ExecutionRun, RunEnvironment } from './execution-types.js';

/** Keeps verified candidate pointers isolated by captured execution environment. */
export class CandidatePointers {
  /** Shares the assignment transaction so delivery and candidate selection cannot diverge. */
  constructor(private readonly db: ExecutionDatabase) {}

  /** Promotes within the run's immutable environment; legacy records retain their original key. */
  promote(runId: string, candidate: Record<string, unknown>): void {
    const run = this.db.get<ExecutionRun>('run', runId);
    this.db.put('candidate', {
      id: this.key(run.data.authorityBase, run.data.packageId, run.environment),
      runId,
    });
    this.db.put('run', {
      ...run,
      data: { ...run.data, ...candidate, promotedAt: new Date().toISOString() },
    });
  }

  /** Advances a live candidate only from matching newly verified promotion attribution. */
  acceptPromotion(runId: string, delivery: DeliveryRecord, proof: PromotionCandidate): void {
    this.db.transaction('promotion.verified', { runId, deliveryId: delivery.id }, () => {
      const run = this.db.get<ExecutionRun>('run', runId);
      this.validatePromotion(run, delivery, proof.record);
      if (run.data.promotionStage === 'verified') {
        if (
          run.data.deliveryId !== delivery.id ||
          run.data.candidateRevision !== delivery.candidate
        )
          throw new Error('Verified promotion attribution cannot change');
        return;
      }
      if (
        !proof.goalEvidence.length ||
        proof.goalEvidence.some((path) => !delivery.verification.references.includes(path))
      )
        throw new Error('Promotion requires fresh retained goal evidence');
      this.promote(runId, {
        candidateRevision: delivery.candidate,
        candidateRecord: proof.record,
        goalEvidence: proof.goalEvidence,
        goalCandidate: delivery.candidate,
        verifiedEvidence: delivery.verification.references,
        deliveryId: delivery.id,
        pendingPublication: delivery.id,
        promotionStage: 'verified',
      });
    });
  }

  /** Keeps source lineage and target authority explicit without manufacturing engineering assignments. */
  private validatePromotion(
    run: ExecutionRun,
    delivery: DeliveryRecord,
    record: Record<string, unknown>,
  ): void {
    if (
      !delivery.promotedFrom ||
      run.data.promotionSource !== delivery.promotedFrom ||
      delivery.runId !== run.id ||
      delivery.environment.mode !== 'live' ||
      JSON.stringify(delivery.environment) !== JSON.stringify(run.environment) ||
      delivery.authorityDigest !== run.data.executionIdentity ||
      delivery.base !== run.data.authorityBase ||
      delivery.packageId !== run.data.packageId ||
      delivery.engineering !== 'verified' ||
      !delivery.verification.references.length ||
      record.id !== delivery.candidateRecordId ||
      record.base !== delivery.candidate ||
      record.executionRunId !== run.id ||
      record.status !== 'completed'
    )
      throw new Error('Promotion evidence differs from target run authority');
  }

  /** Returns only the latest verified candidate from the requested environment. */
  latest(
    authorityBase: string,
    packageId: string,
    environment?: RunEnvironment,
  ): ExecutionRun | undefined {
    const id = this.key(authorityBase, packageId, environment);
    const pointer = this.db
      .all<{ id: string; runId: string }>('candidate')
      .find((p) => p.id === id);
    return pointer ? this.db.get('run', pointer.runId) : undefined;
  }

  /** Distinguishes same-mode environments as well as live versus simulated candidates. */
  private key(base: unknown, packageId: unknown, environment?: RunEnvironment): string {
    return JSON.stringify(
      environment ? [base, packageId, environment.mode, environment.id] : [base, packageId],
    );
  }
}
