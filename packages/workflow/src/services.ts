import type { StandingGoal } from '../../planner/src/inventory.js';
import type { Capture } from '../../architecture/src/index.js';
import type {
  DirectionResult,
  Feedback,
  Milestone,
  Plan,
  PlanActivity,
  RevisionRequest,
  Rejection,
  StandingGoalEvidence,
  StewardCheckFailure,
} from '../../direction/src/index.js';
import type { Candidate, Verdict } from '../../verification/src/index.js';

export interface TaskInput {
  directory: string;
  goal: string;
  scope?: string;
  standing?: boolean;
  planning?: 'exploration' | 'objective';
}

export interface Observation {
  phase: 'planning' | 'activity' | 'verification' | 'delivery' | 'question';
  message: string;
  evidence?: readonly string[];
}

export interface TaskObserver {
  progress(observation: Observation): void;
  answer?(question: string, signal: AbortSignal): Promise<string | undefined>;
}

export type TaskOutcome =
  | { kind: 'merged'; commit: string; evidence: readonly string[] }
  | { kind: 'planned'; commit: string; summary: string; evidence: readonly string[] }
  | { kind: 'satisfied'; commit: string; summary: string; evidence: readonly string[] }
  | {
      kind: 'invalid' | 'blocked' | 'failed' | 'cancelled';
      reason: string;
      evidence: readonly string[];
    };

export type TaskEvent =
  | Observation
  | { plan: Plan; supplier?: SupplierLink }
  | {
      position: { completed: number; activities: Readonly<Record<string, number>> };
      repair?: ActivityRepair;
    }
  | { candidate: Candidate; verdict: Verdict }
  | { feedback: Feedback }
  | { activation: ActivityCheckpoint }
  | { assessment: Extract<TaskOutcome, { kind: 'satisfied' | 'planned' }> };

export interface TaskSession {
  readonly capture: Capture;
  readonly goal: string;
  record(event: TaskEvent): void;
  finish(outcome: TaskOutcome): void;
  close(): void;
  cleanup?(): void;
  history?(): readonly TaskEvent[];
  observations?(): readonly unknown[];
  store?(name: string, contents: string): string;
  ask?: TaskObserver['answer'];
}

/** Hold the current task position while the requested human answer is unavailable. */
export class ClarificationRequired extends Error {
  /** Carry the immutable question artifact into the blocked task outcome. */
  constructor(
    message: string,
    readonly evidence: readonly string[],
  ) {
    super(message);
  }
}

export type Interrupted = Extract<TaskOutcome, { reason: string }>;

/** Record a held gate, failed run or invalid admission with its evidence. */
export function stopped(
  kind: Interrupted['kind'],
  reason: string,
  evidence: readonly string[] = [],
): Interrupted {
  return { kind, reason, evidence };
}

/** Preserve the exact diagnostic when cancellation, a question, or an error stops execution. */
export function interruptedRun(error: unknown, signal: AbortSignal, evidence?: readonly string[]) {
  const reason = error instanceof Error ? error.message : String(error);
  const kind = signal.aborted
    ? 'cancelled'
    : error instanceof ClarificationRequired
      ? 'blocked'
      : 'failed';
  const refs =
    error instanceof ClarificationRequired
      ? [...new Set([...(evidence ?? []), ...error.evidence])]
      : evidence;
  return stopped(kind, reason, refs);
}

export type ActivityOutcome =
  | { kind: 'completed'; evidence: readonly string[]; answer?: string }
  | {
      kind: 'repair';
      activity: Exclude<PlanActivity, 'release' | 'review'>;
      reason: string;
      evidence: readonly string[];
      input?: string;
      failedCheck?: StewardCheckFailure;
    }
  | Omit<Extract<Feedback, { kind: 'supplier' }>, 'requester'>
  | Extract<DirectionResult, { kind: 'question' }>
  | {
      kind: 'blocked';
      reason: string;
      evidence: readonly string[];
      failedCheck?: StewardCheckFailure;
    };

/** Identify an explicit link to the requester while preserving host-generated check corrections. */
export function selfLinkedSupplier(
  request: { kind: string; milestone?: unknown; failedCheck?: unknown },
  requester?: string,
) {
  return (
    request.kind === 'supplier' &&
    !request.failedCheck &&
    requester === request.milestone &&
    requester !== undefined
  );
}

export interface SupplierLink {
  milestone: string;
  request: Extract<Feedback, { kind: 'supplier' }>;
}

export interface ActivityCheckpoint {
  milestone: string;
  owner: string;
  index: number;
  step: Exclude<PlanActivity, 'release'>;
  outcome: ActivityOutcome;
}

export interface ActivityRepair {
  milestone: string;
  activity: string;
  reason: string;
  input?: string;
  evidence: readonly string[];
}

export interface GoalRound {
  id: number;
  goals: readonly StandingGoal[];
  completed?(goal: StandingGoal, scope: string): CompletedGoalOutcome | undefined;
  finish(): void;
}

export type CompletedGoalOutcome = Extract<TaskOutcome, { kind: 'merged' | 'satisfied' }>;

export interface RoundOutcome {
  kind: 'round';
  round: number;
  completed: boolean;
  goals: readonly { id: string; outcome: TaskOutcome }[];
}

export interface WorkflowServices {
  execution: {
    round?(directory: string): GoalRound;
    observeGoal?(session: TaskSession, signal: AbortSignal): StandingGoalEvidence;
    prepare?(session: TaskSession, issue: string, signal: AbortSignal): Promise<void>;
    checkpoint?(
      session: TaskSession,
      activity: ActivityCheckpoint,
      signal: AbortSignal,
    ): Promise<void>;
    admit(
      input: TaskInput,
      signal: AbortSignal,
    ): Promise<TaskSession | Extract<TaskOutcome, { reason: string }>>;
    assemble(
      session: TaskSession,
      signal: AbortSignal,
      allowUnchanged?: boolean,
    ): Promise<Candidate>;
  };
  planner?: {
    propose(
      session: TaskSession,
      mode: NonNullable<TaskInput['planning']>,
      progress: TaskObserver['progress'],
      signal: AbortSignal,
      findings?: readonly Rejection[],
    ): Promise<Plan | Extract<TaskOutcome, { kind: 'planned' }>>;
    apply(session: TaskSession, signal: AbortSignal): Promise<ActivityOutcome>;
  };
  direction: {
    track?(session: TaskSession, signal: AbortSignal): Promise<string>;
    plan(
      session: TaskSession,
      signal: AbortSignal,
      standing?: StandingGoalEvidence,
    ): Promise<unknown>;
    revise(
      session: TaskSession,
      plan: Plan | undefined,
      feedback: Feedback,
      signal: AbortSignal,
      standing?: StandingGoalEvidence,
    ): Promise<unknown>;
  };
  agent: {
    execute(
      session: TaskSession,
      milestone: Milestone,
      activity: Exclude<PlanActivity, 'release'>,
      signal: AbortSignal,
    ): Promise<ActivityOutcome>;
  };
  verification: {
    assess(
      session: TaskSession,
      plan: Plan,
      candidate: Candidate,
      signal: AbortSignal,
    ): Promise<Verdict>;
  };
  delivery: {
    resume?(
      session: TaskSession,
      signal: AbortSignal,
      progress: TaskObserver['progress'],
    ): Promise<TaskOutcome | undefined>;
    integrate(
      session: TaskSession,
      candidate: Candidate,
      verdict: Extract<Verdict, { kind: 'accepted' }>,
      signal: AbortSignal,
    ): Promise<TaskOutcome>;
  };
}
