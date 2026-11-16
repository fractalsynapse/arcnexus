import type { Context } from 'cordis';
import type {
  ActivitySelection,
  AgentInspection,
  Architecture,
  Capture,
  TaskContext,
} from '../../architecture/src/index.js';

export interface InspectionInput extends ActivitySelection {
  directory: string;
}

declare module 'cordis' {
  interface Context {
    agent: Agent;
  }
}

/** Resolve an Agent and prepare its request through the shared builder. */
export class Agent {
  /** Bind the canonical architecture and request service. */
  constructor(private readonly architecture: Architecture) {}

  /** Preview an actor's request before task admission. */
  inspect(input: InspectionInput): AgentInspection {
    return this.prepareRequest(this.architecture.capture(input.directory), input);
  }

  /** Prepare the model envelope from a captured project and optional admitted task data. */
  prepareRequest(
    capture: Capture,
    selection: ActivitySelection,
    task?: TaskContext,
  ): AgentInspection {
    return this.architecture.request(capture, selection, task);
  }
}

export const agentPlugin = {
  inject: ['architecture'],
  /** Register the shared Agent service. */
  apply(context: Context) {
    context.provide('agent', new Agent(context.architecture));
  },
};
