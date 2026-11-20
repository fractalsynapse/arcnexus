import {
  stopped,
  type Observation,
  type TaskInput,
  type TaskSession,
  type WorkflowServices,
} from './services.js';
import { validateVerdict, type Candidate, type Verdict } from '../../verification/src/index.js';
import { validatePlan, type Plan } from '../../direction/src/index.js';
import type { Capture } from '../../architecture/src/index.js';

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

/** Bind the independent verdict to the exact assembled candidate and current evidence. */
export async function assessCandidate(
  services: WorkflowServices,
  session: TaskSession,
  input: TaskInput,
  plan: Plan,
  signal: AbortSignal,
  rejected: ReadonlySet<string>,
) {
  const candidate = await assembleCandidate(services, session, input, signal);
  signal.throwIfAborted();
  if (rejected.has(reviewKey(candidate)))
    throw new Error('Correction repeated a rejected candidate and its review evidence');
  const verdict = await services.verification.assess(session, plan, candidate, signal);
  signal.throwIfAborted();
  validateVerdict(plan, candidate, verdict);
  session.record({ candidate, verdict });
  return { candidate, verdict };
}

/** Record an unchanged assessment or publish a changed tree through the existing service. */
export async function deliverAcceptedCandidate(
  services: WorkflowServices,
  session: TaskSession,
  candidate: Candidate,
  verdict: Extract<Verdict, { kind: 'accepted' }>,
  signal: AbortSignal,
  report: (event: Observation) => void,
) {
  if (candidate.unchanged) {
    const assessment = {
      kind: 'satisfied' as const,
      commit: session.capture.source.revision,
      summary: 'Independent review accepted the checks on the unchanged staging tree',
      evidence: verdict.evidence,
    };
    session.record({ assessment });
    return assessment;
  }
  report({
    phase: 'delivery',
    message: 'Reviewer accepted the candidate',
    evidence: verdict.evidence,
  });
  return services.delivery.integrate(session, candidate, verdict, signal);
}

/** Bind a corrected Planner proposal to its original criteria before the host commits it. */
export async function plannerCorrection(
  proposal: ReturnType<NonNullable<WorkflowServices['planner']>['propose']>,
  prior: Plan,
  capture: Capture,
  evidence: readonly string[],
) {
  const decision = await proposal;
  if ('kind' in decision)
    return stopped('blocked', 'Planner correction needs an approved goal change', evidence);
  const correction = {
    ...decision.milestones[0]!,
    id: `planner-correction-${prior.milestones.length}`,
    criteria: prior.milestones[0]!.criteria,
  };
  const revised = { ...prior, milestones: [...prior.milestones, correction] };
  validatePlan(capture, revised);
  return revised;
}
