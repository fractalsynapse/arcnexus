import { z } from 'zod';

export const recordID = /^[a-z0-9][a-z0-9-]*$/;

const entrySchema = z.strictObject({
  id: z.string(),
  priority: z.number().int().optional(),
  path: z.string(),
  category: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  topics: z.array(z.string()).optional(),
  updated: z.string().optional(),
});
export const guideSummaries = z.strictObject({
  revision: z.string(),
  entries: z.array(entrySchema),
});
export const guideFile = z.strictObject({
  revision: z.string(),
  entry: entrySchema,
  content: z.string(),
});
export const guideHistory = z.strictObject({
  revisions: z.array(z.strictObject({ revision: z.string(), updated: z.string() })),
});
export const guideDifference = z.strictObject({
  path: z.string(),
  before: z.string(),
  after: z.string(),
});

export type GuideKind = 'goals' | 'objectives';

export type Guide = z.output<typeof entrySchema>;
export type GuideCollection = z.output<typeof guideSummaries>;
export type GuideFile = z.output<typeof guideFile>;
export type GuideHistory = z.output<typeof guideHistory>;
export type GuideRevision = GuideHistory['revisions'][number];
export type GuideDifference = z.output<typeof guideDifference>;
