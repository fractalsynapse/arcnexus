import { createElement as h, useSyncExternalStore } from 'react';

export interface Project {
  url: string;
  name: string;
  reachable?: boolean;
}

export const initialProject: Project = {
  url: 'https://github.com/fractalsynapse/arcnexus',
  name: 'ArcNexus',
  reachable: true,
};

let active: Project | undefined = initialProject;
const listeners = new Set<() => void>();

export function selectProject(project: Project | undefined) {
  active = project;
  for (const listener of listeners) listener();
}

/** Use the same project selection in the manager and every workspace heading. */
export function useActiveProject() {
  return useSyncExternalStore(subscribe, () => active);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function ProjectContext() {
  const project = useActiveProject();
  return h('span', { role: 'status' }, project ? 'Project · ' + project.name : 'No active project');
}
