import type { TaskEvent } from '../../workflow/src/index.js';
import type { Milestone } from '../../direction/src/index.js';

/** Deliver complete recorded supplier replies to the milestone that requested them. */
export function supplierContext(events: readonly TaskEvent[], milestone: string) {
  const supplies = events.flatMap((event) =>
    'plan' in event && event.supplier ? [event.supplier] : [],
  );
  const incoming = supplies.filter(({ milestone: supplier }) => supplier === milestone);
  const outgoing = supplies.filter(({ request }) => request.requester === milestone);
  const answers = outgoing.map(({ milestone: supplier, request }) => ({
    question: request.question ?? request.reason,
    supplier,
    replies: events.flatMap((event) => {
      if (!('activation' in event)) return [];
      const { milestone, outcome, step } = event.activation;
      if (milestone !== supplier || outcome.kind !== 'completed') return [];
      return [{ step, answer: outcome.answer, evidence: outcome.evidence }];
    }),
  }));
  return {
    ...(incoming.length ? { supplierRequests: incoming.map(({ request }) => request) } : {}),
    ...(answers.length ? { supplierAnswers: answers } : {}),
  };
}

/** Keep an unanswered supplier question open through the final applicable steward step. */
export function supplierAnswerRequired(
  events: readonly TaskEvent[],
  milestone: Milestone,
  activity: string,
) {
  const last = milestone.steps.findLast(
    (step) => step.activity !== 'release' && !step.inapplicable,
  );
  if (last?.activity !== activity) return false;
  if (!supplierContext(events, milestone.id).supplierRequests?.some(({ question }) => question))
    return false;
  return !events.some(
    (event) =>
      'activation' in event &&
      event.activation.milestone === milestone.id &&
      event.activation.outcome.kind === 'completed' &&
      event.activation.outcome.answer,
  );
}
