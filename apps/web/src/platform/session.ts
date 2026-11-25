import { Subscriptions } from '../../../../packages/ui/src/index.js';
import { useSyncExternalStore } from 'react';

export interface Project {
  id: string;
  remote: string;
  name?: string;
  revision: string;
}

type Session = { project?: Project };

let session: Session = {};
const subscriptions = new Subscriptions();

export function setSession(value: Session) {
  session = value;
  subscriptions.publish();
}

export const subscribeSession = subscriptions.subscribe;

/** Share the active project across workspace routes. */
export function usePlatformSession() {
  return useSyncExternalStore(subscribeSession, activeSession);
}

export function activeSession() {
  return session;
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
