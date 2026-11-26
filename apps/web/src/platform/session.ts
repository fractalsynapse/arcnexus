import { useSyncExternalStore } from 'react';
import { useBrowserPlatform } from './browser-platform.js';
import type { Project } from './project-session.js';
export type { Project } from './project-session.js';

/** Share the active project across workspace routes. */
export function usePlatformSession() {
  const { session } = useBrowserPlatform();
  return useSyncExternalStore(session.subscribe, session.getSnapshot);
}

export function projectName(project: Project) {
  return (
    project.name ??
    project.remote
      .split('/')
      .at(-1)
      ?.replace(/\.git$/, '') ??
    project.id
  );
}
