import { isAbsolute, normalize } from 'node:path';
import { z } from 'zod';
import { imageDigest } from '../../../packages/foundation/src/runtime-image.js';

const local = z
  .string()
  .refine((value) => isAbsolute(value) && normalize(value) === value && !value.includes(','));
const revision = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
const base = { approvedImage: imageDigest, base: imageDigest };

export const hostAssignmentSchema = z
  .strictObject({
    project: z.uuid(),
    remote: z.string().regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/),
    revision,
    documentationOnly: z.literal(true).optional(),
    checkout: local,
    source: local.optional(),
    storage: local,
    credentials: local,
    seedCredentials: local.optional(),
    database: local,
    network: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*_data$/),
    egress: z
      .string()
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*_outbound$/)
      .optional(),
    github: z.strictObject({ appId: z.string().min(1), privateKeyFile: local }).optional(),
    image: z.discriminatedUnion('source', [
      z.strictObject({ ...base, source: z.literal('base') }),
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
  })
  .refine(
    (input) => !input.documentationOnly || (!input.github && input.image.source === 'base'),
    'Documentation discovery requires the trusted Host base image without write credentials',
  );

export type HostAssignment = z.output<typeof hostAssignmentSchema>;
