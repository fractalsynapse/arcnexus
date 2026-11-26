import type { Context } from 'cordis';
import type { CommandBinding } from '../../../../packages/ui/src/index.js';
import type { GuideDraft } from '../../../../packages/planner/src/guide-draft.js';

export type WebCommands = CommandBinding & { saveGuide?(draft: GuideDraft): Promise<void> };

declare module 'cordis' {
  interface Context {
    webCommands: WebCommands;
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
