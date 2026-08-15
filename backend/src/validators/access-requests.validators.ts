import { z } from 'zod';

export const grantBusinessAccessSchema = z.object({
  expiresAt: z.string().datetime().optional(),
});

export const rejectCourseReopenSchema = z.object({
  admin_notes: z.string().max(500).optional(),
});

export const requestCourseReopenSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type GrantBusinessAccessInput = z.infer<typeof grantBusinessAccessSchema>;
export type RejectCourseReopenInput = z.infer<typeof rejectCourseReopenSchema>;
export type RequestCourseReopenInput = z.infer<typeof requestCourseReopenSchema>;
