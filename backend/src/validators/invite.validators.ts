import { z } from 'zod';

export const createInvitationSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['talent', 'business']),
  expires_at: z.string().datetime().optional(),
  company_name: z.string().max(300).optional(),
  contact_person_name: z.string().max(200).optional(),
});

export const businessLoginSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export const assignCategoriesSchema = z.object({
  category_ids: z.array(z.string().uuid()),
});

export const shareProfilesSchema = z.object({
  profile_ids: z.array(z.string().uuid()),
  category_id: z.string().uuid(),
});

export const extendAccessSchema = z.object({
  days: z.number().int().min(1).max(365),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type BusinessLoginInput = z.infer<typeof businessLoginSchema>;
export type AssignCategoriesInput = z.infer<typeof assignCategoriesSchema>;
export type ShareProfilesInput = z.infer<typeof shareProfilesSchema>;
export type ExtendAccessInput = z.infer<typeof extendAccessSchema>;
