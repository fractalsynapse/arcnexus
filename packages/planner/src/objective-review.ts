import { z } from 'zod';

export const objectiveReviewLabel = 'Review objective recommendations';
export const objectiveReviewReady = 'Objective recommendations are ready for review';

const prose = z.string().refine((value) => Boolean(value.trim()), 'Supply nonblank text');
const citation = z.strictObject({
  path: prose.describe('Exact repository-relative path at the captured revision'),
  quote: prose.describe('Verbatim excerpt from the captured file'),
});
export const objectiveCandidate = z.strictObject({
  id: prose.describe('Stable, lowercase Markdown record ID'),
  category: prose.describe('Named category or nested category path'),
  title: prose.describe('Title shown in draft review'),
  gap: prose.describe('Documented intent missing from the current inventory'),
  content: prose.describe('Complete Markdown objective text'),
  sources: z.array(citation).nonempty(),
});
export const objectiveDraft = objectiveCandidate.extend({ path: prose, before: prose.nullable() });
export const objectiveReview = z.strictObject({
  id: prose,
  revision: prose,
  summary: prose,
  drafts: z.array(objectiveDraft).nonempty(),
  sourceChanges: z.array(z.object({ path: prose, quote: prose, revision: prose })).optional(),
  readOnly: z.boolean(),
});

export const objectiveDecision = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('approve'), selected: z.array(prose).nonempty() }),
  z.strictObject({ action: z.literal('decline') }),
  z.strictObject({
    action: z.literal('revise'),
    edits: z.record(prose, prose).optional(),
    feedback: prose.optional(),
  }),
]);

export type ObjectiveReview = z.output<typeof objectiveReview>;
export type ObjectiveDraft = z.output<typeof objectiveDraft>;
export const recommendationAssessment = z.strictObject({
  revision: prose,
  summary: prose,
  selected: z.array(objectiveDraft),
});
export type RecommendationAssessment = z.output<typeof recommendationAssessment>;
export type ObjectiveDecision = z.output<typeof objectiveDecision>;

/** Decode the terminal shortcuts and structured clients through one review contract. */
export function readObjectiveDecision(answer: string, review: ObjectiveReview): ObjectiveDecision {
  const text = answer.trim();
  if (/^skip$/i.test(text)) return { action: 'decline' };
  if (/^approve$/i.test(text))
    return { action: 'approve', selected: review.drafts.map(({ id }) => id) };
  const choice = objectiveDecision.parse(JSON.parse(text) as unknown);
  const ids =
    choice.action === 'approve'
      ? choice.selected
      : Object.keys(choice.action === 'revise' ? (choice.edits ?? {}) : {});
  const allowed = new Set(review.drafts.map(({ id }) => id));
  if (new Set(ids).size !== ids.length || ids.some((id) => !allowed.has(id)))
    throw new Error('Select distinct objective drafts from this review');
  if (choice.action === 'revise' && !ids.length && !choice.feedback)
    throw new Error('Provide edits or feedback to revise recommendations');
  return choice;
}
