import type { Context } from 'cordis';
import type { InspectionInput } from '../../agent/src/index.js';
import type { TaskInput, TaskObserver } from '../../workflow/src/index.js';

declare module 'cordis' {
  interface Context {
    commands: {
      inspect: Context['agent']['inspect'];
      planTask(
        directory: string,
        objective: string | undefined,
        observer: TaskObserver,
        signal: AbortSignal,
      ): ReturnType<Context['workflow']['run']>;
      updateArchitecture(
        directory: string,
        feedback: string | undefined,
        observer: TaskObserver,
        signal: AbortSignal,
      ): ReturnType<Context['workflow']['update']>;
      runTask(
        input: TaskInput,
        observer: TaskObserver,
        signal: AbortSignal,
      ): ReturnType<Context['workflow']['run']>;
      runRound: Context['workflow']['round'];
      refine: Context['workflow']['refine'];
    };
  }
}

export const commandsPlugin = {
  inject: ['agent', 'workflow'],
  /** Delegate structured commands to their owning application services. */
  apply(context: Context) {
    context.provide('commands', {
      inspect: (input: InspectionInput) => context.agent.inspect(input),
      planTask: (directory, objective, observer, signal) =>
        context.workflow.run(
          {
            directory,
            goal: objective ?? 'Map the project’s standing goals',
            planning: objective === undefined ? 'exploration' : 'objective',
            scope: 'plan:objective',
          },
          observer,
          signal,
        ),
      updateArchitecture: (directory, feedback, observer, signal) =>
        context.workflow.update(directory, feedback, observer, signal),
      runTask: (input: TaskInput, observer: TaskObserver, signal: AbortSignal) =>
        context.workflow.run(input, observer, signal),
      runRound: (directory, observer, signal) =>
        context.workflow.round(directory, observer, signal),
    });
  },
};
