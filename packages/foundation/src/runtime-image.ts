import { z } from 'zod';

export const imageDigest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
export const runtimeImageSchema = z.strictObject({ image: imageDigest, base: imageDigest });
export type RuntimeImage = z.output<typeof runtimeImageSchema>;
export const hostedReady = 'ArcNexus Host ready';
