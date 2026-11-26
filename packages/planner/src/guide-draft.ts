import { z } from 'zod';
import { recordID } from './guide-data.js';

export const guideDraft = z.strictObject({
  id: z.string().regex(recordID),
  kind: z.enum(['goals', 'objectives']).optional(),
  revision: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
  content: z.string(),
});

export type GuideDraft = z.infer<typeof guideDraft>;
