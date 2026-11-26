import type { Context } from 'cordis';
import { createElement as h } from 'react';
import { RefineButton } from '../refine-button.js';

const workspaces = [
  { path: '/plan/', label: 'Plan', defaultColumns: 2 as const },
  { path: '/architect/', label: 'Architect', defaultColumns: 2 as const },
  { path: '/run/', label: 'Run' },
  { path: '/release/', label: 'Release' },
];

export function workspacePlugin() {
  return {
    inject: ['ui', 'webCommands'],
    /** Register the frame's workspace links and route-specific header action. */
    apply(context: Context) {
      const headerAction = h(RefineButton, { binding: context.webCommands });
      for (const item of workspaces)
        context.effect(() => context.ui.register({ ...item, headerAction }));
    },
  };
}
