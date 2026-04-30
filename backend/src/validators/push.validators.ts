import { z } from 'zod';

export const registerPushTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['android', 'ios']),
});

export const unregisterPushTokenSchema = z.object({
  token: z.string().min(1),
});

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;
export type UnregisterPushTokenInput = z.infer<typeof unregisterPushTokenSchema>;
