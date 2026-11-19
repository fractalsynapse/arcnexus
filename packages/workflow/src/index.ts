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
import { ArchitectRun } from './architect-run.js';

export type {
  ActivityCheckpoint,
  ActivityOutcome,
  ActivityRepair,
  CompletedGoalOutcome,
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
export { ClarificationRequired, selfLinkedSupplier } from './services.js';

declare module 'cordis' {
  interface Context {
    workflow: Workflow;
  }
}

/** Advance one admitted workflow and record observations through the task services. */
export class Workflow {
  /** Use the execution, direction, agent, verification and delivery services supplied by the app. */
  constructor(private readonly services?: WorkflowServices) {}

  /** Admit a goal or reuse its foreground parent's writer for a normal sequential child task. */
  run(input: TaskInput, observer: TaskObserver, signal: AbortSignal, parent?: TaskSession) {
    return this.invoke(
      input,
      observer,
      signal,
      (session) => new TaskRun(this.services!, session, observer, signal, input).execute(),
      parent,
    );
  }

  /** Assess accepted direction, obtain exact guide approval and deliver prerequisites before returning. */
  update(
    directory: string,
    feedback: string | undefined,
    observer: TaskObserver,
    signal: AbortSignal,
    parent?: TaskSession,
  ) {
    const input = {
      directory,
      goal: feedback ?? 'Assess architecture alignment',
      architecture: true,
      scope: 'architecture:update',
    };
    return this.invoke(
      input,
      observer,
      signal,
      (session) =>
        new ArchitectRun(this.services!, session, observer, signal, (child) =>
          this.run(child, observer, signal, session),
        ).execute(feedback),
      parent,
    );
  }

  /** Share admission, cancellation, evidence, cleanup and terminal recording across foreground phases. */
  private async invoke(
    input: TaskInput,
    observer: TaskObserver,
    signal: AbortSignal,
    execute: (session: TaskSession) => Promise<TaskOutcome>,
    parent?: TaskSession,
  ): Promise<TaskOutcome> {
    if (!input.goal.trim()) return stopped('invalid', 'A task goal is required');
    if (signal.aborted) return stopped('cancelled', 'Task cancelled before admission');
    if (!this.services)
      return stopped('invalid', 'Task execution services are unavailable in this build');
    let session: TaskSession | undefined;
    let outcome: TaskOutcome;
    try {
      const admitted = await this.services.execution.admit(input, signal, parent);
      if ('kind' in admitted) return admitted;
      session = admitted;
      session.ask = observer.answer;
      outcome = await execute(session);
    } catch (error) {
      outcome = interruptedRun(error, signal, session?.evidence);
    }
    return this.complete(session, outcome);
  }

  /** Release one admitted session only after its cleanup and terminal observation are recorded. */
  private complete(session: TaskSession | undefined, outcome: TaskOutcome) {
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
      const scope = `round:${round.id}:${goal.id}`;
      const outcome =
        round.completed?.(goal, scope) ??
        (await this.run({ directory, goal: goal.body, scope, standing: true }, observer, signal));
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
