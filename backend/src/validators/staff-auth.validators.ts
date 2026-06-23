import { z } from 'zod';

export const staffLoginSchema = z.object({
  email: z.string().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

export const staffSsoExchangeSchema = z.object({
  code: z.string().min(1, 'Missing sign-in code'),
});

export type StaffSsoExchangeInput = z.infer<typeof staffSsoExchangeSchema>;
