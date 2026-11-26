import { AgentActivityHold, InvalidAgentResponse } from '../../agent/src/index.js';
import type { HostTask } from '../../execution/src/index.js';

/** Validate model output while preserving distinct repair findings in the task journal. */
export async function generatePlannerResponse<T>(
  task: HostTask,
  signal: AbortSignal,
  generate: (diagnostic: string | undefined) => Promise<T>,
) {
  const seen = new Set<string>();
  let diagnostic: string | undefined;
  while (true) {
    signal.throwIfAborted();
    try {
      return await generate(diagnostic);
    } catch (error) {
      signal.throwIfAborted();
      if (!(error instanceof InvalidAgentResponse)) throw error;
      if (seen.has(error.identity))
        throw new AgentActivityHold(
          `Planner repeated an unchanged finding: ${error.message}`,
          task.evidence.slice(),
        );
      seen.add(error.identity);
      diagnostic = error.message;
      task.note({ plannerResponseRepair: diagnostic });
    }
  }
}

export function validatePlannerResponse<T>(decode: () => T): T {
  try {
    return decode();
  } catch (error) {
    throw new InvalidAgentResponse((error as Error).message, { cause: error });
  }
}
