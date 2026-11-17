import type { Context } from 'cordis';
import { captureProject, type Capture } from './catalog.js';
import type { ActivitySelection } from './activity.js';
import { buildCodexRequest, type TaskContext } from './request.js';

export type { ActivitySelection, Capture, TaskContext };
export type AgentInspection = ReturnType<typeof buildCodexRequest>;

declare module 'cordis' {
  interface Context {
    architecture: Architecture;
  }
}

/** Read the captured model and prepare its Codex request. */
export class Architecture {
  /** Capture the committed project resolved from a working directory. */
  capture(directory: string, revision?: string): Capture {
    return captureProject(directory, revision);
  }

  /** Prepare the request used by inspection and available to activation. */
  request(capture: Capture, selection: ActivitySelection, task?: TaskContext): AgentInspection {
    return buildCodexRequest(capture, selection, task);
  }
}

export const architecturePlugin = {
  /** Register the captured catalog and request service. */
  apply(context: Context) {
    context.provide('architecture', new Architecture());
  },
};
