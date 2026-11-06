import { developmentBase } from './development-base.js';
import { VerificationBaseline } from './verification-baseline.js';
import { assignmentIntent } from './assignment-intent.js';
import { RequestAdmission } from './request-admission.js';
import type { UpstreamBridge } from '../operations/upstream-bridge.js';
import {
  AssignmentRegistry,
  DeliveryEvidence,
  ExecutionEvidence,
  RecoveryEvidence,
} from '../report/report.js';
import { candidateDigest } from '../change-inspection/changes.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, type ProjectExecution } from '../architecture/execution-context.js';
import type { ResolvedAssignment, Assignment } from '../architecture/assignment.js';
import { StewardSession } from '../assignment/steward.js';
import type { ExecutionStore } from '../coordination-store/execution-store.js';
import type {
  ActivationResult,
  ExecutionAssignment,
} from '../coordination-store/execution-types.js';
import { CandidateSnapshots } from '../workspace/candidates.js';
import {
  continueDevelopmentBranch,
  createWorkspace,
  prepareWorkspace,
} from '../workspace/workspace.js';
import { save, type RecordData } from '../workspace/state.js';
import { ProgressObserver } from '../report/progress.js';
import { Direction, VerificationIssue } from '../task-intake/direction.js';
import type { AgentResult } from '../steward/codex.js';

/** Executes one owner stage in an isolated workspace and verifies delivery before promotion. */
export class AssignmentExecution {
  private readonly snapshots: CandidateSnapshots;

  private readonly admission: RequestAdmission;

  /** Captures authority and the project store independently of mutable candidate source. */
  constructor(
    private readonly root: string,
    private readonly context: ProjectExecution,
    private readonly store: ExecutionStore,
    private readonly signal: AbortSignal,
    private readonly collaboration?: (
      assignment: ExecutionAssignment,
    ) => UpstreamBridge | undefined,
  ) {
    this.snapshots = new CandidateSnapshots(context.source, join(root, 'snapshots'));
    this.admission = new RequestAdmission(root, context, store);
  }

  /** Restores retained work, runs one stage and returns only a structured scheduler outcome. */
  async activate(assignment: ExecutionAssignment): Promise<ActivationResult> {
    const record = await this.record(assignment);
    new VerificationBaseline(this.context).capture(record);
    record.collaborationContext = {
      environment: this.store.run(assignment.runId).environment,
      trackingIssue:
        this.store.assignment(assignment.id).data.trackingIssue ??
        this.store.run(assignment.runId).data.trackingIssue,
    };
    this.acknowledge(assignment, record);
    this.dependencyContext(assignment, record);
    record.inboxContext = this.inbox(assignment.id);
    this.feedback(assignment, record);
    const session = this.session(assignment, record);
    if (Array.isArray(assignment.data.questions) && assignment.data.questions.length)
      return this.answer(assignment, record, session);
    if (record.requestCorrection) await this.admission.correct(record, session);
    else if (!record.pendingRequests && !record.pendingInboxActions) await session.step();
    const result = await this.outcome(assignment, record, session);
    return { ...result, receipt: (record.checkpoint as { sha256: string }).sha256 };
  }

  /** Ensures fresh direction reaches a model even when engineering finished before delivery review. */
  private feedback(assignment: ExecutionAssignment, record: RecordData): void {
    const feedback = [assignment.data.continuationReason, record.continuationLoopWarning]
      .filter(Boolean)
      .join('\n');
    if (feedback && feedback !== record.continuationFeedback && record.nextStage === 'finished') {
      const resolved = record.resolvedAssignment as ResolvedAssignment;
      record.nextStage = resolved.assignment.kind === 'change' ? 'review' : 'research';
      record.status = 'running';
    }
    record.continuationFeedback = feedback;
  }

  /** Reconstructs the owner session with host-bound tools and the captured engineering profile. */
  private session(assignment: ExecutionAssignment, record: RecordData): StewardSession {
    const resolved = record.resolvedAssignment as ResolvedAssignment;
    return new StewardSession(
      this.root,
      record,
      assignment.owner,
      assignment.objective,
      resolved.executionProfile.model,
      this.context.executable,
      this.signal,
      undefined,
      this.collaboration?.(assignment),
      this.investigation(assignment, record),
    );
  }

  /** Supplies intent discovery to engineers and private retained evidence only to read-only investigations. */
  private investigation(assignment: ExecutionAssignment, record: RecordData) {
    const resolved = record.resolvedAssignment as ResolvedAssignment;
    const pages =
      resolved.assignment.kind === 'change'
        ? new AssignmentRegistry(this.store).capture(assignment)
        : new RecoveryEvidence(this.root, this.store).capture(assignment);
    record.investigationEvidence = pages.retain(join(this.root, 'runs', record.id), {
      runId: assignment.runId,
      assignmentId: assignment.id,
      artifacts: pages.metadata(),
    });
    save(this.root, record);
    return pages;
  }

  /** Exposes one durable reply identity while keeping internal retry keys out of model context. */
  private inbox(assignmentId: string): unknown[] {
    return this.store.inbox(assignmentId).map(({ id, key: _retryKey, ...request }) => ({
      ...request,
      requestId: id,
      replies: request.replies.map(({ id: _receipt, ...reply }: any) => reply),
    }));
  }

  /** Clears only outputs whose scheduler acknowledgement is durable; unacknowledged outputs replay. */
  private acknowledge(assignment: ExecutionAssignment, record: RecordData): void {
    const checkpoint = record.checkpoint as { sha256: string } | undefined;
    if (!checkpoint || assignment.data.lastReceipt !== checkpoint.sha256) return;
    delete record.pendingRequests;
    delete record.pendingInboxActions;
    save(this.root, record);
  }

  /** Applies inbox outcomes before considering a candidate eligible for independent delivery review. */
  private async outcome(
    assignment: ExecutionAssignment,
    record: RecordData,
    session: StewardSession,
  ): Promise<ActivationResult> {
    if (record.plan && !assignment.data.accepted) this.store.accept(assignment.id);
    const actions = record.pendingInboxActions as AgentResult['inboxActions'];
    const requests = record.pendingRequests as AgentResult['requests'] | undefined;
    if (requests?.length) {
      const routed = this.requests(assignment, record, requests);
      if (routed.kind === 'request' && actions?.length)
        return { kind: 'inbox', requests: routed.requests, actions };
      return routed;
    }
    if (actions?.length) return { kind: 'responses', actions };
    if (record.status === 'blocked') return { kind: 'blocked', reason: String(record.error) };
    if (record.status !== 'completed') return { kind: 'continue' };
    try {
      return await this.deliver(assignment, record, session);
    } catch (error) {
      if (!(error instanceof VerificationIssue)) throw error;
      return this.repair(record, error);
    }
  }

  /** Returns actionable independent findings to the existing assignment without resetting its evidence. */
  private repair(record: RecordData, issue: VerificationIssue): ActivationResult {
    const feedback = JSON.stringify(issue.result);
    const gaps = issue.result.criteria
      .filter((criterion) => criterion.verdict !== 'verified' || !criterion.evidence.length)
      .map((criterion) => criterion.index)
      .sort((left, right) => left - right);
    const warning = new ProgressObserver(this.root, record, 'independentProgress').failed(
      { activity: 'independent-verification' },
      JSON.stringify({ gaps, status: issue.result.status }),
      candidateDigest(record),
    );
    record.correctiveFeedback = warning ? `${feedback}\n${warning}` : feedback;
    record.independentFindings = issue.result;
    const assignment = (record.resolvedAssignment as ResolvedAssignment).assignment;
    record.nextStage = assignment.kind === 'change' ? 'implementation' : 'research';
    record.status = 'running';
    save(this.root, record);
    return { kind: 'continue' };
  }

  /** Runs a read-only correlated answer on the requester's retained thread. */
  private async answer(
    assignment: ExecutionAssignment,
    record: RecordData,
    session: StewardSession,
  ): Promise<ActivationResult> {
    const result = await session.reply(
      `Answer these correlated inbox questions without source edits. Return inboxActions with action=answer, exact requestId and text; requests=[]: ${JSON.stringify(assignment.data.questions)}`,
    );
    if (!result.inboxActions?.length) throw new Error('Clarification requires a correlated answer');
    record.pendingInboxActions = result.inboxActions;
    save(this.root, record);
    return {
      kind: 'responses',
      actions: result.inboxActions,
      receipt: (record.checkpoint as { sha256: string }).sha256,
    };
  }

  /** Loads an existing candidate or captures a new owner-scoped assignment. */
  private async record(assignment: ExecutionAssignment): Promise<RecordData> {
    if (typeof assignment.data.recordId === 'string') {
      const record = JSON.parse(
        readFileSync(join(this.root, 'runs', assignment.data.recordId, 'report.json'), 'utf8'),
      ) as RecordData;
      return this.refresh(assignment, record);
    }
    const run = this.store.run(assignment.runId);
    const base = String(run.data.candidateRevision ?? this.context.base);
    const record = await this.capture(assignment, base);
    this.store.updateAssignment(assignment.id, 'running', {
      recordId: record.id,
      candidateBase: base,
    });
    save(this.root, record);
    return record;
  }

  /** Captures assignment authority and associates a fresh workspace with its durable execution identity. */
  private async capture(assignment: ExecutionAssignment, base: string): Promise<RecordData> {
    const value = assignmentIntent(
      assignment.objective,
      assignment.acceptance,
      assignment.data.proposal as Partial<Assignment> | undefined,
    );
    const resolved = new ExecutionContext().assignment(this.context, assignment.owner, value);
    const record = await this.developmentWorkspace(assignment, base);
    record.executionRunId = assignment.runId;
    record.executionEnvironment = this.store.run(assignment.runId).environment;
    record.assignmentId = assignment.id;
    record.environment = resolved.environment;
    record.resolvedAssignment = resolved;
    record.directionAccepted = true;
    record.trustedVerificationPaths = this.context.verificationInputs;
    return record;
  }

  /** Shares staging resolution and branch provenance between new and reconciled steward workspaces. */
  private async developmentWorkspace(assignment: ExecutionAssignment, base: string) {
    const environment = this.store.run(assignment.runId).environment;
    const branchBase = await developmentBase(
      this.context,
      environment?.mode,
      base,
      join(this.root, 'projects', this.context.key, 'target-observations'),
      this.signal,
    );
    return createWorkspace(this.root, {
      project: this.context.source,
      authorityBase: this.context.base,
      packageId: this.context.packageId,
      base,
      branchBase,
      bindings: this.context.bindings,
    });
  }

  /** Distinguishes accepted intent from verified delivery and preserves explicit milestone semantics. */
  private dependencyContext(assignment: ExecutionAssignment, record: RecordData): void {
    const dependencies = assignment.dependencies.map((id) => this.store.assignment(id));
    if (!dependencies.length) return;
    const delivered = dependencies.filter((dependency) => dependency.status === 'completed');
    record.coordinationContext =
      'Dependency assignment states (accepted intent is not verified delivery): ' +
      JSON.stringify(dependencies.map((item) => this.dependency(item))) +
      '\nRequired dependency milestones: ' +
      JSON.stringify(assignment.data.milestones ?? {}) +
      (delivered.length
        ? '\nVerified dependency deliveries: ' +
          JSON.stringify(delivered.map((item) => this.dependency(item)))
        : '') +
      '\nVerified dependency assessments: ' +
      JSON.stringify(
        delivered.map((dependency) => ({
          assignmentId: dependency.id,
          owner: dependency.owner,
          deliveredRevision: dependency.data.deliveredRevision,
          reviews: new DeliveryEvidence(this.root).capture(dependency, false),
        })),
      ) +
      '\nIf accepted intent is insufficient, return inboxActions with action=require_delivery, the existing requestId from General inbox requests (not the dependency assignment ID), and an explanation. Use only the envelope’s availableActions; incoming requests and outgoing dependencies have different reply authority. Completed delivery needs no acknowledgment. Do not create another request or restate accepted scope; this action strengthens only the existing milestone.';
  }

  /** Projects actionable dependency facts without recursively copying activation or raw evidence state. */
  private dependency(item: ExecutionAssignment) {
    return {
      id: item.id,
      owner: item.owner,
      objective: item.objective,
      acceptance: item.acceptance,
      status: item.status,
      dependencies: item.dependencies,
      evidence: item.evidence,
      accepted: item.data.accepted === true,
      deliveredRevision: item.data.deliveredRevision,
      reason: item.data.reason,
    };
  }

  /** Incorporates verified deliveries without losing incomplete owner changes or frozen evidence. */
  private async refresh(assignment: ExecutionAssignment, record: RecordData): Promise<RecordData> {
    const current = String(
      this.store.run(assignment.runId).data.candidateRevision ?? this.context.base,
    );
    if (record.base === current) return record;
    const incoming = this.snapshots.capture(record.workspace, record.base);
    const merged = this.snapshots.reconcile(record.base, current, incoming);
    if (merged.status !== 'merged') throw new Error('Candidate conflict: ' + merged.evidence);
    const next = await this.materialize(assignment, record, current, merged.revision);
    record.previousWorkspaces = [
      ...((record.previousWorkspaces ?? []) as string[]),
      record.workspace,
    ];
    Object.assign(record, {
      workspace: next.workspace,
      branch: next.branch,
      branchBase: record.branchBase ?? next.branchBase,
      members: next.members,
      materializationBinding: next.materializationBinding,
      base: current,
    });
    delete record.developmentHead;
    if (record.nextStage === 'finished') record.nextStage = 'review';
    record.reconciledCandidateDigest = candidateDigest(record);
    record.reconciliationId = next.id;
    save(this.root, record);
    this.store.updateAssignment(assignment.id, 'running', { reconciliation: null });
    return record;
  }

  /** Materializes a reconciled candidate while retaining the owner's edits relative to the new base. */
  private async materialize(
    assignment: ExecutionAssignment,
    record: RecordData,
    current: string,
    revision: string,
  ): Promise<RecordData> {
    const next = await this.developmentWorkspace(assignment, current);
    next.environment = record.environment;
    next.resolvedAssignment = record.resolvedAssignment;
    next.assignmentId = assignment.id;
    next.executionRunId = assignment.runId;
    next.executionEnvironment = record.executionEnvironment;
    this.store.updateAssignment(assignment.id, 'running', {
      reconciliation: { recordId: next.id, workspace: next.workspace, current, revision },
    });
    await prepareWorkspace(this.root, next, this.signal);
    this.snapshots.apply(next.workspace, current, revision);
    continueDevelopmentBranch(record, next);
    save(this.root, next);
    return next;
  }

  /** Converts precise boundary requests to durable identities; unknown owners remain blockers. */
  private requests(
    assignment: ExecutionAssignment,
    record: RecordData,
    requests: AgentResult['requests'],
  ): ActivationResult {
    if (requests.some((r) => !r.ownerId || !this.context.owners.includes(r.ownerId)))
      return { kind: 'blocked', reason: JSON.stringify(requests) };
    if (!this.admission.accept(record, assignment, requests)) return { kind: 'continue' };
    return {
      kind: 'request',
      requests: requests.map((r, index) => ({
        key: `${assignment.id}:${(record.checkpoint as { sha256: string }).sha256}:${index}`,
        owner: r.ownerId!,
        existingAssignmentId: r.assignmentId ?? undefined,
        kind: r.kind,
        changeType: r.changeType,
        milestone: r.milestone ?? 'delivered',
        objective: r.request,
        acceptance: r.acceptanceCriteria,
      })),
    };
  }

  /** Independently reviews the assembled result before updating the verified candidate pointer. */
  private async deliver(
    assignment: ExecutionAssignment,
    record: RecordData,
    session: StewardSession,
  ): Promise<ActivationResult> {
    await session.verifyFinal();
    const evidence = await new Direction(this.root, this.context, this.signal).verify(
      record,
      assignment.owner,
      assignment.objective,
      { criteria: assignment.acceptance, commands: record.commands, worker: record.agent },
      false,
      new ExecutionEvidence(this.root, this.store).capture(assignment.runId),
    );
    const revision = this.snapshots.capture(record.workspace, record.base);
    return {
      kind: 'completed',
      evidence,
      candidate: {
        candidateRevision: revision,
        candidateRecord: record,
        verifiedEvidence: evidence,
      },
    };
  }
}
