export interface RunEnvironment {
  id: string;
  mode: 'live' | 'simulation';
}

export type RunMode = 'task' | 'workday';

export const runStatuses = [
  'running',
  'idle',
  'pausing',
  'paused',
  'stopping',
  'stopped',
  'interrupted',
  'needs_attention',
  'completed',
  'needs_input',
  'failed',
  'cancelled',
] as const;

export type RunStatus = (typeof runStatuses)[number];

/** Terminal run states cannot dispatch more engineering without creating a new run. */
export const terminalRunStatuses: readonly RunStatus[] = [
  'completed',
  'stopped',
  'cancelled',
  'failed',
];

export type AssignmentStatus =
  | 'ready'
  | 'running'
  | 'waiting'
  | 'prepared'
  | 'completed'
  | 'blocked'
  | 'rejected'
  | 'failed'
  | 'interrupted';

/** Only diagnosed unsuccessful assignments can be reopened by a director continuation. */
export function canReopenAssignment(status: AssignmentStatus): boolean {
  return status === 'failed' || status === 'blocked' || status === 'rejected';
}

/** Unaccepted checkpointed work can receive direction without dropping its dependencies. */
export function canContinueAssignment(status: AssignmentStatus): boolean {
  return ['ready', 'waiting', 'prepared'].includes(status) || canReopenAssignment(status);
}

export interface ExecutionRun {
  id: string;
  environment?: RunEnvironment;
  mode: RunMode;
  owners: string[];
  objective: string;
  status: RunStatus;
  createdAt: string;
  data: Record<string, unknown>;
}

export interface AssignmentContinuation {
  assignmentId: string;
  ownerId: string;
  reason: string;
  replacementChangeType?: 'behavior' | 'documentation' | 'refactor';
}

/** An attributed checkpoint snapshot remains unverified until its complete assembly is accepted. */
export interface PreparedContribution {
  recordId: string;
  base: string;
  revision: string;
  checkpoint: string;
}

export interface ExecutionAssignment {
  id: string;
  runId: string;
  owner: string;
  objective: string;
  acceptance: string[];
  status: AssignmentStatus;
  dependencies: string[];
  evidence: string[];
  data: Record<string, unknown>;
}

/** Applies the single dependency milestone rule to scheduling, continuation and retirement. */
export function dependencySatisfied(
  source: ExecutionAssignment,
  dependency: ExecutionAssignment,
): boolean {
  const required = (source.data.milestones as Record<string, string> | undefined)?.[dependency.id];
  return (
    dependency.status === 'completed' ||
    (required === 'accepted' && dependency.data.accepted === true)
  );
}

export interface OwnerRequest {
  kind?: 'change' | 'research' | 'review' | null;
  changeType?: 'behavior' | 'documentation' | 'refactor' | null;
  existingAssignmentId?: string;
  milestone?: 'accepted' | 'delivered';
  key: string;
  owner: string;
  objective: string;
  acceptance: string[];
}

export interface InboxRequest extends OwnerRequest {
  id: string;
  from: string;
  assignmentId: string;
  retired?: boolean;
  retiredByAdmission?: string;
  retirementRationale?: string;
}

export interface DirectionProposal {
  owner: string;
  objective: string;
  acceptance: string[];
  data: Record<string, unknown>;
}

export interface RequestRetirement {
  assignmentId: string;
  requestId: string;
  rationale?: string;
}

export interface DirectionAdmissionTransition {
  id: string;
  proposals: DirectionProposal[];
  continuations: AssignmentContinuation[];
  checkpoint: Record<string, unknown>;
  retirements: RequestRetirement[];
}

export type ActivationResult = { receipt?: string } & (
  | { kind: 'request'; requests: OwnerRequest[] }
  | {
      kind: 'inbox';
      requests: OwnerRequest[];
      actions: import('./inbox-decisions.js').InboxDecision[];
    }
  | { kind: 'prepared'; contribution: PreparedContribution }
  | { kind: 'completed'; evidence: string[]; candidate?: Record<string, unknown> }
  | {
      kind: 'responses';
      actions: Array<{
        requestId: string;
        action: 'accept' | 'reject' | 'clarify' | 'answer' | 'require_delivery' | 'feedback';
        text: string;
      }>;
    }
  | { kind: 'continue' }
  | { kind: 'blocked'; reason: string }
);

/**
 * What one run was asked to produce.
 *
 * `goal` is the whole loop. `plan` stops after direction: the proposal is retained and nothing is
 * dispatched, so no assignment, tracking issue, branch, pull request or release can be created by a
 * run that only asked to see the plan. In-place component stances are added separately because they
 * change where work is written, which is a different guarantee from stopping early.
 */
export type RunStance =
  | { kind: 'goal' }
  | { kind: 'plan' }
  /**
   * In-place work on the current checkout: one component, optionally one activity of it.
   *
   * `fanOut` marks the `--activity`-without-`--component` case, where several components would
   * write into the same checkout at once. That case demands a strictly clean tree, while a single
   * component may proceed on a dirty tree provided the uncommitted paths do not intersect what it
   * owns — two components editing the same file in one checkout is corruption, one component
   * reading a file an operator is editing is not that same hazard.
   */
  | { kind: 'component'; component?: string; activity?: string; fanOut: boolean };

/**
 * True when a run addresses a component to work in place.
 *
 * Sealed stances share the simulated upstream connectivity, so environment mode alone cannot say
 * whether the run owns an isolated candidate: an in-place run edits the operator's checkout and must
 * therefore skip the steps that exist to build and protect a separate one.
 */
export function isInPlaceRun(run: { data?: Record<string, unknown> }): boolean {
  return (run.data?.stance as { kind?: string } | undefined)?.kind === 'component';
}
