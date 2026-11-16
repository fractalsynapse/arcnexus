import type { Context } from 'cordis';
import type { InspectionInput } from '../../agent/src/index.js';

declare module 'cordis' {
  interface Context {
    commands: {
      inspect: Context['agent']['inspect'];
    };
  }
}

export const commandsPlugin = {
  inject: ['agent'],
  /** Expose inspection as a structured SDK operation. */
  apply(context: Context) {
    context.provide('commands', {
      inspect: (input: InspectionInput) => context.agent.inspect(input),
    });
  },
};
