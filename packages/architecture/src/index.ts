import type { Context } from 'cordis';
import { captureProject, type Capture } from './catalog.js';
import type { ActivitySelection } from './activity.js';
import { buildCodexRequest, type TaskContext } from './request.js';
import type { Agent } from '../../agent/src/index.js';
import type { HostTask } from '../../execution/src/index.js';
import { ArchitectureAssessment } from './assessment.js';

export type { ActivitySelection, Capture, TaskContext };
export { revisionCitation, type RevisionCitation } from './revision-citation.js';
export { canResearch, researchDirectory } from './research.js';
export type AgentInspection = ReturnType<typeof buildCodexRequest>;
export type { OperationHandler } from './tools.js';
export { operationTool } from './tools.js';
export type { ArchitectureProposal, ArchitectureDecision } from './proposal.js';
export type { ArchitectureRecord } from './approval.js';
export { architectureIdentity } from './proposal.js';
export { architectureGate, architectureQuestion } from './approval.js';

declare module 'cordis' {
  interface Context {
    architecture: Architecture;
  }
}

/** Read the captured model and prepare its Codex request. */
export class Architecture {
  /** Assess accepted guides through the real Agent and durable host approval path. */
  propose(agent: Agent, task: HostTask, feedback: string | undefined, signal: AbortSignal) {
    return new ArchitectureAssessment(agent, task, feedback, signal).propose();
  }

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

export { prepareArchitectureProposal } from './decode-proposal.js';
export { operationID, resolveOperation } from './operation.js';
export { validateCapture } from './validation.js';
