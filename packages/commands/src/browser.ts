import { z } from 'zod';
import { runtimeImageSchema } from '../../foundation/src/runtime-image.js';
import { objectiveReview } from '../../planner/src/objective-review.js';
import { workflowRequest } from './request.js';

export const workflowSelection = z.strictObject({ id: z.uuid() });
export const workflowReceipt = z.strictObject({
  id: z.uuid(),
  request: workflowRequest,
  revision: z.string(),
  runtime: runtimeImageSchema.nullable().optional(),
  state: z.enum(['queued', 'running', 'waiting', 'finished']),
  execution: z.string().nullable(),
  gate: z
    .strictObject({ id: z.string(), question: z.string(), review: objectiveReview.optional() })
    .nullable(),
  outcome: z.unknown(),
});

export const workflowSubmission = workflowSelection.extend({ request: workflowRequest });
export const workflowAnswer = workflowSelection.extend({
  gate: z.string(),
  answer: z.string().refine((answer) => Boolean(answer.trim())),
});

export const currentWorkflow = z.strictObject({
  canSubmit: z.boolean(),
  receipt: workflowReceipt.nullable(),
});

export type CurrentWorkflow = z.output<typeof currentWorkflow>;
export type Receipt = z.output<typeof workflowReceipt>;
