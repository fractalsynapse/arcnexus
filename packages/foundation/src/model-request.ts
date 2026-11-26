import { z } from 'zod';

/** The resolved model request shared by Inspect and retained startup evidence. */
export const modelRequest = z.strictObject({
  input: z.string(),
  options: z.record(z.string(), z.unknown()),
});

export type ModelRequest = z.output<typeof modelRequest>;
