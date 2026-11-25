import { EventDisplay } from './event-display.js';
import { PlanDisplay } from './plan-display.js';
import { GuideDisplay } from './guide-display.js';
import { createElement as h } from 'react';
import type { Context } from 'cordis';

export const planDisplaysPlugin = {
  inject: ['ui', 'webCommands'],
  /** Register the independent Plan data displays with the shared workspace. */
  apply(context: Context) {
    const binding = context.webCommands;
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
        defaultColumn: 1,
      },
      { id: 'files', label: 'Files', content: h(GuideDisplay) },
      { id: 'events', label: 'Event log', content: h(EventDisplay, { binding }), defaultColumn: 1 },
    ];
    for (const display of displays)
      context.effect(() => context.ui.registerDisplay('/plan/', display));
  },
};
