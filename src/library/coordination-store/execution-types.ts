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
  'ready' | 'running' | 'waiting' | 'completed' | 'blocked' | 'rejected' | 'failed' | 'interrupted';

/** Only diagnosed unsuccessful assignments can be reopened by a director continuation. */
export function canReopenAssignment(status: AssignmentStatus): boolean {
  return status === 'failed' || status === 'blocked' || status === 'rejected';
}

/** Ready checkpointed work can receive direction without being replaced or replayed. */
export function canContinueAssignment(status: AssignmentStatus): boolean {
  return status === 'ready' || canReopenAssignment(status);
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
}

export type ActivationResult = { receipt?: string } & (
  | { kind: 'request'; requests: OwnerRequest[] }
  | {
      kind: 'inbox';
      requests: OwnerRequest[];
      actions: import('./inbox-decisions.js').InboxDecision[];
    }
  | { kind: 'completed'; evidence: string[]; candidate?: Record<string, unknown> }
  | {
      kind: 'responses';
      actions: Array<{
        requestId: string;
        action: 'accept' | 'reject' | 'clarify' | 'answer' | 'require_delivery';
        text: string;
      }>;
    }
  | { kind: 'continue' }
  | { kind: 'blocked'; reason: string }
);
