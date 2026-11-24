import { z } from 'zod';

export const providerInfoSchema = {
  name: z.string().trim().min(1),
  platform: z.string().trim().min(1),
};

export const enrollmentSchema = z.strictObject({ code: z.string().min(1), ...providerInfoSchema });
export const providerIdentitySchema = z.strictObject({ id: z.uuid(), token: z.string().min(1) });
export const providerDecisionSchema = z.strictObject({ state: z.enum(['admitted', 'revoked']) });
export const providerSchema = z.strictObject({
  id: z.uuid(),
  ...providerInfoSchema,
  state: z.enum(['pending', 'admitted', 'revoked']),
});
