import type { Context } from 'cordis';
import { createElement as h } from 'react';
import { RefineButton } from '../refine-button.js';
import { PlanContext } from '../platform/plan-context.js';
import { PlanScope } from '../platform/plan-resource.js';
import { PlanRunSelector } from '../platform/plan-run-selector.js';
import type { PropsWithChildren } from 'react';

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
      const binding = context.webCommands;
      const headerAction = h(RefineButton, { binding });
      const scope = ({ children }: PropsWithChildren) => h(PlanScope, { binding }, children);
      for (const item of workspaces) {
        context.effect(() =>
          context.ui.register({
            ...item,
            headerAction,
            ...(item.path === '/plan/' && {
              context: h(PlanContext),
              titleAction: h(PlanRunSelector),
              scope,
            }),
          }),
        );
      }
    },
  };
}
