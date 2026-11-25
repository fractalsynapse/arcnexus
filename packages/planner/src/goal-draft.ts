import { z } from 'zod';

export const goalDraft = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  revision: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
  content: z.string(),
});

export type GoalDraft = z.infer<typeof goalDraft>;
