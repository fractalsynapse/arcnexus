import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import type { ExecutionRun, ExecutionAssignment } from '../coordination-store/execution-types.js';
import { DeliveryEvidence } from '../report/report.js';
import { candidateDigest } from '../change-inspection/changes.js';
import { VerificationAssessment } from '../task-intake/direction.js';
import { git } from '../operations/process.js';
import { CandidateSnapshots } from '../workspace/candidates.js';
import type { RecordData } from '../workspace/state.js';

/** Validates retained independent evidence against the exact candidate before publication capture. */
export class DeliveryVerification {
  /** Uses only host-owned evidence paths; caller-authored acceptance files are not publication authority. */
  constructor(private readonly root: string) {}

  /** Requires completed accountable work, current source bytes and independently accepted evidence. */
  capture(run: ExecutionRun, assignments: ExecutionAssignment[], candidate: RecordData) {
    this.candidate(run, candidate);
    this.assignments(run, assignments);
    const references = this.references(run, assignments);
    const reviews = references.map((reference) => this.read(reference, run));
    if (
      run.mode === 'task' &&
      !reviews.some((review) => review.activationRole === 'director-assessment')
    )
      throw new Error('Missing independent goal assessment');
    const last = assignments.find((assignment) => assignment.data.recordId === candidate.id);
    const accepted =
      last &&
      reviews.find(
        (review) => review.parentRecordId === candidate.id && review.activationRole === 'verifier',
      );
    if (!accepted || accepted.verificationEvidence?.candidateDigest !== candidateDigest(candidate))
      throw new Error('Delivery candidate differs from independent acceptance');
    return {
      references,
      digest: createHash('sha256').update(JSON.stringify(reviews)).digest('hex'),
    };
  }

  /** Refuses unfinished assignments and missing or mismatched independent worker assessments. */
  private assignments(run: ExecutionRun, assignments: ExecutionAssignment[]): void {
    if (
      !assignments.length ||
      assignments.some(
        (assignment) =>
          assignment.runId !== run.id ||
          assignment.status !== 'completed' ||
          !assignment.evidence.length,
      )
    )
      throw new Error('Delivery has unfinished or foreign assignments');
    const observations = assignments.flatMap((assignment) =>
      new DeliveryEvidence(this.root).capture(assignment, false),
    );
    if (observations.some((entry: any) => entry.evidenceUnavailable))
      throw new Error('Independent assignment evidence is unavailable');
  }

  /** Checks isolated candidate objects without importing source or changing a caller branch. */
  private candidate(run: ExecutionRun, candidate: RecordData): void {
    if (
      !run.environment ||
      JSON.stringify(candidate.executionEnvironment) !== JSON.stringify(run.environment) ||
      candidate.executionRunId !== run.id ||
      candidate.status !== 'completed'
    )
      throw new Error('Candidate identity or engineering completion mismatch');
    const revision = new CandidateSnapshots(candidate.source, join(this.root, 'snapshots')).capture(
      candidate.workspace,
      candidate.base,
    );
    const observed = git(candidate.source, 'rev-parse', `${revision}^{tree}`).trim();
    const accepted = git(
      candidate.source,
      'rev-parse',
      `${String(run.data.candidateRevision)}^{tree}`,
    ).trim();
    if (observed !== accepted) throw new Error('Candidate changed after verified delivery');
    if (run.mode === 'task' && run.status !== 'completed')
      throw new Error('Task requires director goal acceptance before delivery');
  }

  /** Requires the goal assessment for tasks while workdays retain independent delivery assessments. */
  private references(run: ExecutionRun, assignments: ExecutionAssignment[]): string[] {
    const goals = run.data.goalEvidence as string[] | undefined;
    if (run.mode === 'task' && (!Array.isArray(goals) || !goals.length))
      throw new Error('Missing director goal assessment');
    return [
      ...new Set([...assignments.flatMap((assignment) => assignment.evidence), ...(goals ?? [])]),
    ];
  }

  /** Rejects foreign or incomplete reviews before incorporating their immutable content into the digest. */
  private read(reference: string, run: ExecutionRun): any {
    const id = basename(dirname(reference));
    if (
      !/^[a-f0-9-]{36}$/.test(id) ||
      resolve(reference) !== resolve(this.root, 'runs', id, 'report.json') ||
      !lstatSync(reference).isFile() ||
      lstatSync(reference).isSymbolicLink()
    )
      throw new Error('Invalid retained delivery review reference');
    const review = JSON.parse(readFileSync(reference, 'utf8'));
    if (
      review.id !== id ||
      review.executionRunId !== run.id ||
      review.status !== 'completed' ||
      review.agent?.status !== 'completed' ||
      !['verifier', 'director-assessment'].includes(review.activationRole) ||
      JSON.stringify(review.executionEnvironment) !== JSON.stringify(run.environment)
    )
      throw new Error('Retained delivery review identity or completion mismatch');
    if (!Array.isArray(review.acceptanceCriteria) || !review.acceptanceCriteria.length)
      throw new Error('Missing captured review criteria');
    new VerificationAssessment().validate(review.agent, review.acceptanceCriteria);
    return review;
  }
}
