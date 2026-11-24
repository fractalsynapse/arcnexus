import type { Context } from 'cordis';
import type { CommandBinding } from '../../../../packages/ui/src/index.js';

declare module 'cordis' {
  interface Context {
    webCommands: CommandBinding;
  }
}

export function commandBindingPlugin(binding: CommandBinding) {
  return {
    /** Publish the command binding selected for this web composition. */
    apply(context: Context) {
      context.provide('webCommands', binding);
    },
  };
}
