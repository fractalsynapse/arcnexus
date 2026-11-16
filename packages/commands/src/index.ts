import type { Context } from 'cordis';
import type { InspectionInput } from '../../agent/src/index.js';
import type { TaskInput, TaskObserver } from '../../workflow/src/index.js';

declare module 'cordis' {
  interface Context {
    commands: {
      inspect: Context['agent']['inspect'];
      runTask: Context['workflow']['run'];
    };
  }
}

export const commandsPlugin = {
  inject: ['agent', 'workflow'],
  /** Delegate structured commands to their owning application services. */
  apply(context: Context) {
    context.provide('commands', {
      inspect: (input: InspectionInput) => context.agent.inspect(input),
      runTask: (input: TaskInput, observer: TaskObserver, signal: AbortSignal) =>
        context.workflow.run(input, observer, signal),
    });
  },
};
