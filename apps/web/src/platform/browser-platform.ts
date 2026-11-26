import { createContext, useContext } from 'react';
import type { Context } from 'cordis';
import { GatewayClient, type GatewayTransport } from './gateway-client.js';
import { ProjectSession, type Project } from './project-session.js';
import type { TimelineFrame } from './timeline-stream.js';

export interface TimelineSnapshot {
  frames: TimelineFrame[];
  cursor?: string;
}

export interface BrowserPlatform {
  gateway: GatewayClient;
  session: ProjectSession;
  timelines: Map<string, TimelineSnapshot>;
}

export interface PlatformOptions {
  transport?: GatewayTransport;
  project?: Project;
}

declare module 'cordis' {
  interface Context {
    webPlatform: BrowserPlatform;
  }
}

export const platformScope = createContext<BrowserPlatform | undefined>(undefined);

/** Use the same scoped platform service as the enclosing Cordis composition. */
export function useBrowserPlatform() {
  const platform = useContext(platformScope);
  if (!platform) throw new Error('Browser platform services require a mounted composition');
  return platform;
}

export function browserPlatformPlugin({ transport, project }: PlatformOptions = {}) {
  return {
    /** Isolate gateway access, project selection and replay state to a mounted application. */
    apply(context: Context) {
      context.provide('webPlatform', {
        gateway: new GatewayClient(transport ?? ((path, request) => fetch('/api' + path, request))),
        session: new ProjectSession(project),
        timelines: new Map(),
      } satisfies BrowserPlatform);
    },
  };
}
