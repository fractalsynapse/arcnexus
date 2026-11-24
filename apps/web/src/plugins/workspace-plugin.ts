import type { Context } from 'cordis';
import { createElement as h } from 'react';
import { Button } from '../../../../packages/ui/src/index.js';

const refine = h(Button, { icon: 'refine', disabled: true }, 'Refine');
const workspaces = [
  { path: '/plan/', label: 'Plan', headerAction: refine, defaultColumns: 2 as const },
  { path: '/architect/', label: 'Architect', headerAction: refine, defaultColumns: 2 as const },
  { path: '/run/', label: 'Run', headerAction: refine },
  { path: '/release/', label: 'Release', headerAction: refine },
];

export function workspacePlugin() {
  return {
    inject: ['ui'],
    /** Register the frame's workspace links and route-specific header action. */
    apply(context: Context) {
      for (const item of workspaces) {
        context.effect(() => context.ui.register(item));
      }
    },
  };
}
