import type { Context } from 'cordis';
import type { Workspace } from './types.js';
import './style.css';

export { CommandPanel } from './command-panel.js';
export { Dialog, IconButton } from './controls.js';
export { PageLayout, WebFrame } from './frame.js';
export { Icon } from './icons.js';
export { ColorSchemes, SchemeSelect } from './schemes.js';
export type { CommandBinding, CommandRequest, CommandState, Workspace } from './types.js';

declare module 'cordis' {
  interface Context {
    ui: UiRegistry;
  }
}

/** Collect the workspace definitions contributed by trusted browser plugins. */
export class UiRegistry {
  private readonly entries = new Map<string, Workspace>();

  /** Register one workspace and remove it when its owning plugin is disposed. */
  register(workspace: Workspace) {
    if (this.entries.has(workspace.path))
      throw new Error('Duplicate workspace path: ' + workspace.path);
    this.entries.set(workspace.path, workspace);
    return () => {
      this.entries.delete(workspace.path);
    };
  }

  /** Return the workspace definitions in their registered navigation order. */
  workspaces(): readonly Workspace[] {
    return [...this.entries.values()];
  }
}

export const uiPlugin = {
  /** Provide the shared UI registration service to browser composition. */
  apply(context: Context) {
    context.provide('ui', new UiRegistry());
  },
};
