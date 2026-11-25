import type { Context } from 'cordis';
import type { CommandBinding } from '../../../../packages/ui/src/index.js';
import type { GoalDraft } from '../../../../packages/planner/src/goal-draft.js';

export type WebCommands = CommandBinding & { saveGoal?(draft: GoalDraft): Promise<void> };

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
