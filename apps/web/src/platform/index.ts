import { EventDisplay } from './event-display.js';
import { PlanDisplay, type PlanReadout } from './plan-display.js';
import { createElement as h } from 'react';
import type { Context } from 'cordis';
import { ConnectionManager } from './connection-manager.js';
import { GuideDisplay, type GuideKind } from './guide-display.js';
import { ProjectManager } from './project-manager.js';
import { projectName, usePlatformSession } from './session.js';
import './platform.css';

function WorkspaceProject() {
  const { project } = usePlatformSession();
  return h(
    'span',
    { role: 'status' },
    project ? 'Project · ' + projectName(project) : 'No active project',
  );
}

const guides: Array<{ id: GuideKind; label: string }> = [
  { id: 'objectives', label: 'Objectives' },
  { id: 'goals', label: 'Goals' },
];

const readouts: Array<{ id: PlanReadout; label: string; defaultColumn?: number }> = [
  { id: 'metrics', label: 'Planner metrics' },
  { id: 'outcome', label: 'Planner outcome', defaultColumn: 1 },
];

export const platformUiPlugin = {
  inject: ['ui'],
  /** Add live platform managers and independent Plan displays to the shared web frame. */
  apply(context: Context) {
    context.effect(() => context.ui.registerHeaderControl('connections', h(ConnectionManager)));
    context.effect(() => context.ui.registerHeaderControl('projects', h(ProjectManager)));
    context.effect(() => context.ui.registerWorkspaceContext(h(WorkspaceProject)));
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
        content: h(EventDisplay),
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
