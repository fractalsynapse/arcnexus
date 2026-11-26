import { EventDisplay } from './event-display.js';
import { PlanDisplay } from './plan-display.js';
import { GuideDisplay } from './guide-display.js';
import { createElement as h, type PropsWithChildren } from 'react';
import type { Context } from 'cordis';
import { PlanContext } from './plan-context.js';
import { PlanScope } from './plan-resource.js';
import { PlanRunSelector } from './plan-run-selector.js';
import { PlanStartupContext } from './plan-startup-context.js';

export const planPlugin = {
  inject: ['ui', 'webCommands'],
  /** Own the Plan scope, workspace views and independently mounted displays. */
  apply(context: Context) {
    const binding = context.webCommands;
    context.effect(() =>
      context.ui.registerWorkspaceFeature('/plan/', {
        context: h(PlanContext),
        sections: [{ title: 'Context', content: h(PlanStartupContext) }],
        titleAction: h(PlanRunSelector),
        scope: ({ children }: PropsWithChildren) => h(PlanScope, { binding }, children),
      }),
    );
    const displays = [
      {
        id: 'metrics',
        label: 'Planner metrics',
        content: h(PlanDisplay, { kind: 'metrics' }),
      },
      {
        id: 'outcome',
        label: 'Planner outcome',
        content: h(PlanDisplay, { kind: 'outcome' }),
        defaultRegion: 1,
      },
      { id: 'files', label: 'Files', content: h(GuideDisplay) },
      { id: 'events', label: 'Event log', content: h(EventDisplay, { binding }), defaultRegion: 1 },
    ];
    for (const display of displays)
      context.effect(() => context.ui.registerDisplay('/plan/', display));
  },
};
