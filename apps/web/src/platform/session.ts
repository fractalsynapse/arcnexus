import { useSyncExternalStore } from 'react';

export interface Project {
  id: string;
  remote: string;
  name?: string;
  revision: string;
}

type Session = { token?: string; project?: Project };

let session: Session = {};
const listeners = new Set<() => void>();

export function setSession(value: Session) {
  session = value;
  for (const listener of listeners) listener();
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Share the active project and in-memory operator session across workspace routes. */
export function usePlatformSession() {
  return useSyncExternalStore(subscribeSession, activeSession);
}

export function activeSession() {
  return session;
}

export function projectName(project: Project) {
  return (
    project.remote
      .split('/')
      .at(-1)
      ?.replace(/\.git$/, '') ?? project.id
  );
}
