import type { TaskInput, TaskSession, WorkflowServices } from './services.js';
import type { Candidate } from '../../verification/src/index.js';

/** Bind assembly review identity to the exact tree and material evidence presented. */
export function reviewKey(candidate: Candidate) {
  return `${candidate.digest}:${candidate.ownerEvidenceDigest ?? ''}`;
}

/** Apply approved guides after prerequisites, then assemble exactly the tree the independent Reviewer sees. */
export async function assembleCandidate(
  services: WorkflowServices,
  session: TaskSession,
  input: TaskInput,
  signal: AbortSignal,
) {
  if (input.guide) {
    if (!services.execution.applyGuide)
      throw new Error('Approved architecture application is unavailable');
    await services.execution.applyGuide(session, input.guide, signal);
  }
  return services.execution.assemble(session, signal, Boolean(input.standing || input.inbox));
}
