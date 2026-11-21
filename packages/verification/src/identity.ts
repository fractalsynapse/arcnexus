import { textDigest } from '../../foundation/src/index.js';
import type { Plan } from '../../direction/src/index.js';
import { hostTask } from '../../execution/src/index.js';
import type { TaskSession } from '../../workflow/src/index.js';
import type { Candidate, VerificationIdentity } from './index.js';

/** Identify the work, authority, complete promise and actual observations assessed together. */
export function verificationIdentity(
  session: TaskSession,
  plan: Plan,
  candidate: Candidate,
  checks: unknown,
): VerificationIdentity {
  const task = hostTask(session);
  return {
    tree: candidate.digest,
    base: task.config.capture.source.revision,
    capture: task.capture.source.revision,
    acceptance: textDigest(JSON.stringify({ goal: task.goal, plan })),
    inputs: textDigest(JSON.stringify({ ownerEvidence: candidate.ownerEvidenceDigest, checks })),
  };
}
