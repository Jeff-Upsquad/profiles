import { z } from 'zod';

export const appCheckinSchema = z.object({
  version_name: z.string().min(1).max(40),
  version_code: z.number().int().nonnegative(),
  platform: z.enum(['android', 'ios']),
});

export type AppCheckinInput = z.infer<typeof appCheckinSchema>;
