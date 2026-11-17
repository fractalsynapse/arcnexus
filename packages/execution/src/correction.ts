import { basename } from 'node:path';
import type { Feedback, Milestone, RevisionFeedback } from '../../direction/src/index.js';
import type { TaskEvent } from '../../workflow/src/index.js';
import type { CheckResult } from './check.js';

type Correction = Extract<RevisionFeedback, { kind: 'supplier' | 'rejection' }>;

/** Recover the specific feedback that first introduced this milestone into the admitted plan. */
export function correctionFinding(events: readonly TaskEvent[], milestone: Milestone) {
  const addition = events.findIndex(
    (event) => 'plan' in event && event.plan.milestones.some(({ id }) => id === milestone.id),
  );
  const history = events.slice(0, addition);
  const previous = history.findLastIndex((event) => 'plan' in event);
  if (addition < 0 || previous < 0) return undefined;
  const event = history
    .slice(previous + 1)
    .findLast((event) => 'feedback' in event && isCorrection(event.feedback));
  if (!event || !('feedback' in event) || !isCorrection(event.feedback)) return undefined;
  return feedbackForOwner(event.feedback, milestone);
}

/** Only a supplier request or reviewer rejection can open correction work. */
function isCorrection(feedback: Feedback): feedback is Correction {
  return feedback.kind === 'supplier' || feedback.kind === 'rejection';
}

/** Limit a corrective assignment to findings that match its owner and acceptance. */
function feedbackForOwner(feedback: Correction, milestone: Milestone) {
  if (feedback.kind === 'supplier')
    return feedback.owner === milestone.owner ? feedback : undefined;
  const ids = new Set(milestone.criteria.map(({ id }) => id));
  const findings = feedback.findings.filter(
    ({ owner, criterion }) => owner === milestone.owner && ids.has(criterion),
  );
  return findings.length ? { kind: feedback.kind, findings } : undefined;
}

interface CheckObservation {
  check?: Pick<CheckResult, 'id' | 'status' | 'log'>;
  scope?: { owner?: string };
}

/** Select captured assembly checks named explicitly or cited through a failing log. */
export function citedAssemblyChecks(
  observations: readonly CheckObservation[],
  finding: Correction,
  acceptance: readonly string[],
) {
  const findings = finding.kind === 'rejection' ? finding.findings : [finding];
  const citations = new Set(
    findings.flatMap(({ reason, evidence }) => [
      ...reason.split(/[^a-z0-9_.-]+/i).map((term) => term.replace(/\.+$/, '')),
      ...evidence,
    ]),
  );
  const ids = new Set<string>();
  for (const { check, scope } of observations) {
    if (!check || scope || !acceptance.includes(check.id)) continue;
    const failureCited =
      check.status !== 0 && (citations.has(check.log) || citations.has(basename(check.log)));
    if (citations.has(check.id) || failureCited) ids.add(check.id);
  }
  return [...ids];
}
