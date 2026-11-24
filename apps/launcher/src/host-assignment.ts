import { isAbsolute, normalize } from 'node:path';
import { z } from 'zod';

const local = z
  .string()
  .refine((value) => isAbsolute(value) && normalize(value) === value && !value.includes(','));
const revision = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
const imageId = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const base = { approvedImage: imageId, base: imageId };

export const hostAssignmentSchema = z.strictObject({
  project: z.uuid(),
  remote: z.string().regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/),
  revision,
  checkout: local,
  storage: local,
  credentials: local,
  seedCredentials: local.optional(),
  database: local,
  network: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*_data$/),
  image: z.discriminatedUnion('source', [
    z.strictObject({
      ...base,
      source: z.literal('registry'),
      ref: z.string().regex(/^[\w][\w./:-]*@sha256:[0-9a-f]{64}$/),
    }),
    z.strictObject({
      ...base,
      source: z.literal('dockerfile'),
      baseRef: z.string().regex(/^[\w][\w./:@-]*$/),
      checkout: local,
      revision,
      dockerfile: z
        .string()
        .regex(/^(?!.*(?:^|\/)\.\.(?:\/|$))[\w./-]+$/)
        .refine((value) => !value.startsWith('/') && !value.startsWith('-')),
    }),
  ]),
});

export type HostAssignment = z.output<typeof hostAssignmentSchema>;
