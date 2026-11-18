import type { Context } from 'cordis';
import { interruptedRun, stopped } from './services.js';
import type {
  RoundOutcome,
  TaskInput,
  TaskObserver,
  TaskOutcome,
  TaskSession,
  WorkflowServices,
} from './services.js';
import { TaskRun } from './task-run.js';

export type {
  ActivityCheckpoint,
  ActivityOutcome,
  GoalRound,
  RoundOutcome,
  Observation,
  TaskEvent,
  TaskInput,
  TaskObserver,
  TaskOutcome,
  TaskSession,
  WorkflowServices,
} from './services.js';
export type { StandingGoal } from '../../planner/src/inventory.js';
export { ClarificationRequired } from './services.js';

declare module 'cordis' {
  interface Context {
    workflow: Workflow;
  }
}

/** Advance one admitted workflow and record observations through the task services. */
export class Workflow {
  /** Use the execution, direction, agent, verification and delivery services supplied by the app. */
  constructor(private readonly services?: WorkflowServices) {}

  /** Admit the goal, run the sequential loop and retain one terminal outcome. */
  async run(input: TaskInput, observer: TaskObserver, signal: AbortSignal): Promise<TaskOutcome> {
    if (!input.goal.trim()) return stopped('invalid', 'A task goal is required');
    if (signal.aborted) return stopped('cancelled', 'Task cancelled before admission');
    if (!this.services)
      return stopped('invalid', 'Task execution services are unavailable in this build');
    let session: TaskSession | undefined;
    let run: TaskRun | undefined;
    let outcome: TaskOutcome;
    try {
      const admitted = await this.services.execution.admit(input, signal);
      if ('kind' in admitted) return admitted;
      session = admitted;
      run = new TaskRun(this.services, session, observer, signal, input);
      outcome = await run.execute();
    } catch (error) {
      outcome = interruptedRun(error, signal, run?.evidence);
    }
    try {
      outcome = this.finalize(session, outcome);
      session?.finish(outcome);
      return outcome;
    } finally {
      session?.close();
    }
  }

  /** Run one admitted task per goal, preserving the round identity when a goal stops. */
  async round(
    directory: string,
    observer: TaskObserver,
    signal: AbortSignal,
  ): Promise<RoundOutcome> {
    const round = this.services?.execution.round?.(directory);
    if (!round) throw new Error('Standing goal rounds are unavailable');
    const goals: RoundOutcome['goals'][number][] = [];
    for (const goal of round.goals) {
      if (signal.aborted) break;
      observer.progress({ phase: 'planning', message: `Round ${round.id} · ${goal.id}` });
      const outcome = await this.run(
        {
          directory,
          goal: goal.body,
          scope: `round:${round.id}:${goal.id}`,
          standing: true,
        },
        observer,
        signal,
      );
      goals.push({ id: goal.id, outcome });
      if (outcome.kind !== 'merged' && outcome.kind !== 'satisfied') break;
    }
    const completed =
      goals.length === round.goals.length &&
      goals.every(({ outcome }) => outcome.kind === 'merged' || outcome.kind === 'satisfied');
    if (completed) round.finish();
    return { kind: 'round', round: round.id, completed, goals };
  }

  /** Keep the terminal record accurate if the host cannot safely remove its worktree. */
  private finalize(session: TaskSession | undefined, outcome: TaskOutcome): TaskOutcome {
    try {
      session?.cleanup?.();
      return outcome;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return stopped('failed', `Task workspace cleanup failed: ${message}`, outcome.evidence);
    }
  }
}

/** Mount the same Workflow service for the CLI and other adapters. */
export function workflowPlugin(services?: WorkflowServices) {
  return (context: Context) => {
    context.provide('workflow', new Workflow(services));
  };
}
