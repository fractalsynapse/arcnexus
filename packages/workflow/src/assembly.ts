import type { TaskInput, TaskSession, WorkflowServices } from './services.js';

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
