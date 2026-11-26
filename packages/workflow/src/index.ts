import { roundCount, type RoundCount } from './round-count.js';
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
import { RefinementRun } from './refinement-run.js';
import type { RunObserver } from './observer.js';
import type { DocumentationSettings } from '../../architecture/src/index.js';
import { textDigest } from '../../foundation/src/index.js';

export type { RoundCount } from './round-count.js';

export type {
  ActivityCheckpoint,
  ActivityOutcome,
  ActivityRepair,
  CompletedGoalOutcome,
  CompletedRefinementRound,
  RefinementProgress,
  GoalRound,
  RoundOutcome,
  Observation,
  TaskEvent,
  TaskInput,
  TaskObserver,
  TaskQuestion,
  TaskOutcome,
  TaskSession,
  WorkflowServices,
} from './services.js';
export type { StandingGoal } from '../../planner/src/inventory.js';
export { ClarificationRequired, selfLinkedSupplier } from './services.js';
export { localRepairIndex, localRepairTargets } from './activity-repair.js';

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
  async run(input: TaskInput, observer: TaskObserver, signal: AbortSignal, parent?: TaskSession) {
    const reporting = (await import('./observer.js')).RunObserver.for(observer);
    return this.invoke(
      input,
      reporting,
      signal,
      (session, writer) => new TaskRun(this.services!, session, reporting, writer, input).execute(),
      parent,
    );
  }

  /** Assess accepted direction, obtain exact guide approval and deliver prerequisites before returning. */
  async update(
    directory: string,
    change: string | DocumentationSettings | undefined,
    observer: TaskObserver,
    signal: AbortSignal,
    parent?: TaskSession,
    scope = 'architecture:update',
  ) {
    const reporting = (await import('./observer.js')).RunObserver.for(observer);
    const documentation = typeof change === 'object' ? change : undefined;
    const feedback = typeof change === 'string' ? change : undefined;
    const input = {
      directory,
      goal: documentation
        ? 'Update project documentation directories'
        : (feedback ?? 'Assess architecture alignment'),
      architecture: true,
      scope: documentation ? scope + ':' + textDigest(JSON.stringify(documentation)) : scope,
    };
    return this.invoke(
      input,
      reporting,
      signal,
      (session, writer) =>
        new ArchitectRun(this.services!, session, reporting, writer, (child) =>
          this.run(child, reporting, writer, session),
        ).execute(feedback, documentation),
      parent,
    );
  }

  /** Run repeatable Planner, Architect and priority-ordered goal assessments under one writer. */
  async refine(
    directory: string,
    rounds: RoundCount,
    observer: TaskObserver,
    signal: AbortSignal,
  ): Promise<TaskOutcome> {
    const total = roundCount(rounds);
    if (!total) return stopped('invalid', 'Round count must be a positive integer');
    if (signal.aborted) return stopped('cancelled', 'Task cancelled before admission');
    const reporting = (await import('./observer.js')).RunObserver.for(observer);
    if (!this.services)
      return stopped('invalid', 'Task execution services are unavailable in this build');
    const input = { directory, goal: 'Continuous refinement', scope: 'refine' };
    return this.invoke(input, reporting, signal, (session, writer) =>
      new RefinementRun(
        this.services!,
        session,
        reporting,
        writer,
        total,
        (child, parent) => this.run(child, reporting, signal, parent),
        (root, output, cancellation, parent, scope) =>
          this.update(root, undefined, output, cancellation, parent, scope),
      ).execute(),
    );
  }

  /** Share admission, cancellation, evidence, cleanup and terminal recording across foreground phases. */
  private async invoke(
    input: TaskInput,
    observer: RunObserver,
    signal: AbortSignal,
    execute: (session: TaskSession, signal: AbortSignal) => Promise<TaskOutcome>,
    parent?: TaskSession,
  ): Promise<TaskOutcome> {
    if (!input.goal.trim()) return stopped('invalid', 'A task goal is required');
    if (signal.aborted) return stopped('cancelled', 'Task cancelled before admission');
    if (!this.services)
      return stopped('invalid', 'Task execution services are unavailable in this build');
    let session: TaskSession | undefined;
    let outcome: TaskOutcome;
    let active = signal;
    try {
      const admitted = await this.services.execution.admit(input, signal, parent);
      if ('kind' in admitted) return admitted;
      session = admitted;
      if (session.signal) active = AbortSignal.any([signal, session.signal]);
      active.throwIfAborted();
      session.listen?.((event) => observer.event?.(event));
      observer.admittedSession(session);
      outcome = await execute(session, active);
    } catch (error) {
      outcome = interruptedRun(error, active, session?.evidence);
    }
    return this.complete(session, outcome);
  }

  /** Release one admitted session only after its cleanup and terminal observation are recorded. */
  private complete(session: TaskSession | undefined, outcome: TaskOutcome) {
    try {
      if (session?.signal?.aborted)
        return interruptedRun(session.signal.reason, session.signal, session.evidence);
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
    observer = (await import('./observer.js')).RunObserver.for(observer);
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
    const outcome = { kind: 'round', round: round.id, completed, goals } as const;
    if (completed) {
      await observer.completeRound?.(outcome);
      round.finish();
    }
    return outcome;
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
