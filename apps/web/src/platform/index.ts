import { createElement as h } from 'react';
import type { Context } from 'cordis';
import { platformCommandsPlugin } from './command-binding.js';
import { ConnectionManager } from './connection-manager.js';
import { planDisplaysPlugin } from './plan-displays.js';
import { planFilePlugin } from './plan-file-plugin.js';
import { ProjectManager } from './project-manager.js';
import {
  activeSession,
  projectName,
  setSession,
  usePlatformSession,
  type Project,
} from './session.js';
import { api } from './resource.js';
import './platform.css';

function WorkspaceProject() {
  const { project } = usePlatformSession();
  return h(
    'span',
    { role: 'status' },
    project ? 'Project · ' + projectName(project) : 'No active project',
  );
}

/** Open the sole project by default and preserve a selection made while it loads. */
function selectInitialProject() {
  const initial = activeSession();
  const controller = new AbortController();
  if (!initial.project)
    void api<{ entries: Project[] }>('/projects', { signal: controller.signal }).then(
      ({ entries }) => {
        if (entries.length === 1 && initial === activeSession() && !controller.signal.aborted)
          setSession({ project: entries[0] });
      },
      () => {},
    );
  return () => controller.abort();
}

export const platformUiPlugin = {
  inject: ['ui'],
  /** Add live platform managers and independent Plan displays to the shared web frame. */
  async apply(context: Context) {
    await context.use(platformCommandsPlugin);
    context.effect(selectInitialProject);
    context.effect(() => context.ui.registerHeaderControl('connections', h(ConnectionManager)));
    context.effect(() => context.ui.registerHeaderControl('projects', h(ProjectManager)));
    context.effect(() => context.ui.registerWorkspaceContext(h(WorkspaceProject)));
    await context.use(planDisplaysPlugin);
    await context.use(planFilePlugin);
  },
};
