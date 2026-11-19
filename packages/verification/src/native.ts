import type { Agent } from '../../agent/src/index.js';
import type { Plan } from '../../direction/src/index.js';
import { hostTask, type HostTask } from '../../execution/src/index.js';
import { assess } from '../../reviewer/src/index.js';
import type { TaskSession } from '../../workflow/src/index.js';
import type { Candidate, Verdict } from './index.js';

/** Run the captured acceptance checklist before an independent review. */
export async function verify(
  agent: Agent,
  session: TaskSession,
  plan: Plan,
  candidate: Candidate,
  signal: AbortSignal,
): Promise<Verdict> {
  const task = hostTask(session);
  const checks = pendingReviewChecks(task, candidate) ?? (await runChecks(task, signal));
  const ownerFailure = ownerEvidenceFailure(task, plan, candidate);
  if (ownerFailure)
    return { kind: 'blocked', reason: ownerFailure, evidence: [] };
  const unavailable = checks.find(({ status }) => status === null || status === 'not-applicable');
  if (unavailable)
    return {
      kind: 'blocked',
      reason: `Required check ${unavailable.id} is unavailable`,
      evidence: [unavailable.log],
    };
  const verdict = await assess(agent, session, plan, candidate, checks, signal);
  const failed = checks.filter((result) => result.status !== 0);
  if (verdict.kind === 'accepted' && failed.length)
    return {
      kind: 'blocked',
      reason: 'Required candidate checks failed',
      evidence: failed.map(({ log }) => log),
    };
  return verdict;
}

/** Require current evidence for every captured owner operation before review. */
function ownerEvidenceFailure(task: HostTask, plan: Plan, candidate: Candidate) {
  const required = plan.milestones.flatMap(({ owner, steps }) =>
    steps.flatMap(({ activity }) =>
      (task.capture.components[owner]?.activities[activity]?.operations ?? []).map((id) => ({
        owner,
        activity,
        id,
        operation: task.capture.operations[id],
      })),
    ),
  );
  const observations = task.ownerReviewChecks();
  for (const { owner, activity, id, operation } of required) {
    const matching = observations.filter(
      ({ scope, check }) => scope.owner === owner && scope.activity === activity && check.id === id,
    );
    const observation = matching.findLast(({ afterLastEdit }) => afterLastEdit) ?? matching.findLast(
      ({ scope, check }) =>
        scope.expected === 'fail' && activity === 'testing' && id === 'owner-tests' && check.status !== 0,
    );
    if (!observation) return `Required owner operation ${owner}/${activity}/${id} has no current evidence`;
    if (!task.evidence.includes(observation.check.log))
      return `Required owner operation ${owner}/${activity}/${id} has unavailable evidence`;
    const retainedExpectedRed =
      observation.scope.expected === 'fail' && activity === 'testing' && id === 'owner-tests' && observation.check.status !== 0;
    if (!observation.afterLastEdit && !retainedExpectedRed)
      return `Required owner operation ${owner}/${activity}/${id} is stale`;
    if (observation.check.status === 'not-applicable') {
      const selection = observation.check.selection;
      if (
        operation?.applicability && selection?.operation === id &&
        selection.owner === owner && selection.files.length === 0 && selection.identity === 'empty'
      ) continue;
      return `Required owner operation ${owner}/${activity}/${id} is unexpectedly inapplicable`;
    }
    if (observation.check.status === null)
      return `Required owner operation ${owner}/${activity}/${id} is unavailable`;
    const expectedRed =
      observation.scope.expected === 'fail' && activity === 'testing' && id === 'owner-tests' && observation.check.status !== 0;
    if (observation.check.status !== 0 && !expectedRed)
      return `Required owner operation ${owner}/${activity}/${id} failed`;
    if (observation.candidate && observation.candidate.tree !== candidate.digest)
      return `Required owner operation ${owner}/${activity}/${id} belongs to another candidate`;
  }
}

type VerifiedCheck = Awaited<ReturnType<HostTask['check']>>;

/** Run the captured checklist once, retaining the exact failure or unavailable result. */
async function runChecks(task: HostTask, signal: AbortSignal) {
  const checks: VerifiedCheck[] = [];
  for (const id of task.capture.project.checks?.acceptance ?? []) {
    const result = await task.check(id, signal);
    checks.push(result);
    if (result.status === null || result.status === 'not-applicable') break;
  }
  return checks;
}

/** Resume research-assisted assessment on the same tree, checks and captured inputs. */
function pendingReviewChecks(task: HostTask, candidate: Candidate) {
  const events = task.observations<{
    verdict?: Verdict;
    researchingVerification?: {
      candidate: string;
      ownerEvidenceDigest?: string;
      revision: string;
      checks: VerifiedCheck[];
    };
  }>();
  const pending = events
    .slice(events.findLastIndex(({ verdict }) => !!verdict) + 1)
    .findLast(
      ({ researchingVerification }) => researchingVerification?.candidate === candidate.digest,
    )?.researchingVerification;
  if (
    pending?.revision === task.capture.source.revision &&
    pending.ownerEvidenceDigest === candidate.ownerEvidenceDigest &&
    pending.checks.every(({ log }) => task.evidence.includes(log))
  )
    return pending.checks;
}
