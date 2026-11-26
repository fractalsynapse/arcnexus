import { createElement as h } from 'react';
import type { Context } from 'cordis';
import { ActiveProject } from './active-project.js';
import { ProjectManager } from './project-manager.js';
import type { BrowserPlatform } from './browser-platform.js';
import type { Project } from './project-session.js';

function selectInitialProject({ gateway, session }: BrowserPlatform) {
  const initial = session.getSnapshot();
  const controller = new AbortController();
  if (!initial.project)
    void gateway.read<{ entries: Project[] }>('/projects', { signal: controller.signal }).then(
      ({ entries }) => {
        if (entries.length === 1 && initial === session.getSnapshot() && !controller.signal.aborted)
          session.select(entries[0]);
      },
      () => {},
    );
  return () => controller.abort();
}

export const projectManagementPlugin = {
  inject: ['ui', 'webPlatform'],
  /** Pair the project manager's header entry with its composition-scoped selection. */
  apply(context: Context) {
    context.effect(() => selectInitialProject(context.webPlatform));
    context.effect(() => context.ui.registerHeaderControl('projects', h(ProjectManager)));
    context.effect(() =>
      context.ui.registerWorkspaceContext(h('span', { role: 'status' }, h(ActiveProject))),
    );
  },
};
