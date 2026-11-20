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

export interface ActivationInput {
  capture: Capture;
  selection: ActivitySelection;
  task: TaskContext;
}

/** Identify invalid actor output that the calling activity can repair without replaying effects. */
export class InvalidAgentResponse extends Error {
  readonly identity: string;

  /** Retain the exact diagnostic while preserving its finding through domain error causes. */
  constructor(message: string, options?: ErrorOptions & { identity?: string }) {
    super(message, options);
    this.identity =
      options?.identity ??
      (options?.cause instanceof InvalidAgentResponse ? options.cause.identity : message);
  }
}

/** Retain an unresolved actor finding as a durable hold rather than an unhandled execution failure. */
export class AgentActivityHold extends Error {
  /** Keep the exact diagnostic and immutable evidence available to the next invocation. */
  constructor(
    message: string,
    readonly evidence: readonly string[],
  ) {
    super(message);
  }
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

  /** Pass the exact prepared request to the admitted execution capability. */
  activate<T>(
    { capture, selection, task }: ActivationInput,
    execute: (view: AgentInspection, signal: AbortSignal) => Promise<T>,
    signal: AbortSignal,
  ): Promise<T> {
    signal.throwIfAborted();
    const view = this.prepareRequest(capture, selection, task);
    if (view.placeholders.length)
      throw new Error(`Missing activation inputs: ${view.placeholders.join(', ')}`);
    return execute(view, signal);
  }
}

export const agentPlugin = {
  inject: ['architecture'],
  /** Register the shared Agent service. */
  apply(context: Context) {
    context.provide('agent', new Agent(context.architecture));
  },
};
