import { z } from 'zod';

const phoneSchema = z
  .string()
  .trim()
  .refine((v) => v.replace(/\D/g, '').length >= 7, 'Phone must have at least 7 digits');

export const createInvitationSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['talent', 'business']),
  expires_at: z.string().datetime().optional(),
  company_name: z.string().max(300).optional(),
  contact_person_name: z.string().max(200).optional(),
  phone: phoneSchema.optional(),
});

export const businessLoginSchema = z
  .object({
    email: z.string().email('Valid email is required').optional(),
    phone: phoneSchema.optional(),
  })
  .refine((v) => !!v.email || !!v.phone, {
    message: 'Email or phone is required',
    path: ['email'],
  });

export const requestAccessSchema = z
  .object({
    email: z.string().email('Valid email is required').optional(),
    phone: phoneSchema.optional(),
  })
  .refine((v) => !!v.email || !!v.phone, {
    message: 'Email or phone is required',
    path: ['email'],
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
export type RequestAccessInput = z.infer<typeof requestAccessSchema>;
export type AssignCategoriesInput = z.infer<typeof assignCategoriesSchema>;
export type ShareProfilesInput = z.infer<typeof shareProfilesSchema>;
export type ExtendAccessInput = z.infer<typeof extendAccessSchema>;
