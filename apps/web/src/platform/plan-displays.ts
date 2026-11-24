import { EventDisplay } from './event-display.js';
import { PlanDisplay, type PlanReadout } from './plan-display.js';
import { createElement as h } from 'react';
import type { Context } from 'cordis';
import { GuideDisplay, type GuideKind } from './guide-display.js';

const guides: Array<{ id: GuideKind; label: string }> = [
  { id: 'objectives', label: 'Objectives' },
  { id: 'goals', label: 'Goals' },
];

const readouts: Array<{ id: PlanReadout; label: string; defaultColumn?: number }> = [
  { id: 'metrics', label: 'Planner metrics' },
  { id: 'outcome', label: 'Planner outcome', defaultColumn: 1 },
];

export const planDisplaysPlugin = {
  inject: ['ui', 'webCommands'],
  /** Register the independent Plan data displays with the shared workspace. */
  apply(context: Context) {
    for (const { id, label, defaultColumn } of readouts)
      context.effect(() =>
        context.ui.registerDisplay('/plan/', {
          id,
          label,
          defaultColumn,
          content: h(PlanDisplay, { kind: id }),
        }),
      );
    context.effect(() =>
      context.ui.registerDisplay('/plan/', {
        id: 'events',
        label: 'Event log',
        content: h(EventDisplay, { binding: context.webCommands }),
        defaultColumn: 1,
      }),
    );
    for (const { id, label } of guides)
      context.effect(() =>
        context.ui.registerDisplay('/plan/', {
          id,
          label,
          content: h(GuideDisplay, { kind: id }),
        }),
      );
  },
};
