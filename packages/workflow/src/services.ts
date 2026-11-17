import type { Capture } from '../../architecture/src/index.js';
import type {
  DirectionResult,
  Feedback,
  Milestone,
  Plan,
  PlanActivity,
} from '../../direction/src/index.js';
import type { Candidate, Verdict } from '../../verification/src/index.js';

export interface TaskInput {
  directory: string;
  goal: string;
  scope?: string;
  measureOwner?: string;
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
  | { kind: 'satisfied'; commit: string; evidence: readonly string[] }
  | {
      kind: 'invalid' | 'blocked' | 'failed' | 'cancelled';
      reason: string;
      evidence: readonly string[];
    };

export type TaskEvent =
  | Observation
  | { plan: Plan }
  | { position: { completed: number; activities: Readonly<Record<string, number>> } }
  | { candidate: Candidate; verdict: Verdict }
  | { feedback: Feedback }
  | { activation: ActivityCheckpoint };

export interface TaskSession {
  readonly capture: Capture;
  readonly goal: string;
  record(event: TaskEvent): void;
  finish(outcome: TaskOutcome): void;
  close(): void;
  cleanup?(): void;
  history?(): readonly TaskEvent[];
}

export type ActivityOutcome =
  | { kind: 'completed'; evidence: readonly string[] }
  | Omit<Extract<Feedback, { kind: 'supplier' }>, 'requester'>
  | Extract<DirectionResult, { kind: 'question' }>
  | { kind: 'blocked'; reason: string; evidence: readonly string[] };

export interface ActivityCheckpoint {
  milestone: string;
  owner: string;
  index: number;
  step: Exclude<PlanActivity, 'release'>;
  outcome: ActivityOutcome;
}

export interface StandingGoal {
  id: string;
  priority: number;
  owner: string;
  body: string;
}

export interface GoalRound {
  id: number;
  goals: readonly StandingGoal[];
  finish(): void;
}

export interface RoundOutcome {
  kind: 'round';
  round: number;
  completed: boolean;
  goals: readonly { id: string; outcome: TaskOutcome }[];
}

export interface WorkflowServices {
  execution: {
    round?(directory: string): GoalRound;
    evaluate?(
      session: TaskSession,
      owner: string,
      signal: AbortSignal,
    ): Promise<TaskOutcome | undefined>;
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
    assemble(session: TaskSession, signal: AbortSignal): Promise<Candidate>;
  };
  direction: {
    track?(session: TaskSession, signal: AbortSignal): Promise<string>;
    plan(session: TaskSession, signal: AbortSignal): Promise<unknown>;
    revise(
      session: TaskSession,
      plan: Plan | undefined,
      feedback: Feedback,
      signal: AbortSignal,
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
