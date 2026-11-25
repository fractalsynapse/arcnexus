import { createElement as h } from 'react';
import type { Context } from 'cordis';
import { platformCommandsPlugin } from './command-binding.js';
import { ConnectionManager } from './connection-manager.js';
import { planDisplaysPlugin } from './plan-displays.js';
import { planFilePlugin } from './plan-file-plugin.js';
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

export const platformUiPlugin = {
  inject: ['ui'],
  /** Add live platform managers and independent Plan displays to the shared web frame. */
  async apply(context: Context) {
    await context.use(platformCommandsPlugin);
    context.effect(() => context.ui.registerHeaderControl('connections', h(ConnectionManager)));
    context.effect(() => context.ui.registerHeaderControl('projects', h(ProjectManager)));
    context.effect(() => context.ui.registerWorkspaceContext(h(WorkspaceProject)));
    await context.use(planDisplaysPlugin);
    await context.use(planFilePlugin);
  },
};
