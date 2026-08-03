import { z } from 'zod';

const phoneSchema = z
  .string()
  .trim()
  .refine((v) => v.replace(/\D/g, '').length >= 7, 'Phone must have at least 7 digits');

export const createInvitationSchema = z
  .object({
    email: z.string().email('Valid email is required').optional(),
    role: z.enum(['talent', 'business']),
    expires_at: z.string().datetime().optional(),
    company_name: z.string().max(300).optional(),
    contact_person_name: z.string().max(200).optional(),
    phone: phoneSchema.optional(),
  })
  .refine((v) => !!v.email || !!v.phone, {
    message: 'Email or phone is required',
    path: ['email'],
  })
  // Talent onboarding is email-based, so a talent invite still needs an email.
  .refine((v) => v.role !== 'talent' || !!v.email, {
    message: 'Email is required for talent invitations',
    path: ['email'],
  });

export const businessLoginSchema = z
  .object({
    email: z.string().email('Valid email is required').optional(),
    phone: phoneSchema.optional(),
    password: z.string().optional(),
  })
  .refine((v) => !!v.email || !!v.phone, {
    message: 'Email or phone is required',
    path: ['email'],
  });

export const businessSignupSchema = z.object({
  email: z.string().email('Valid email is required'),
  phone: phoneSchema,
  name: z.string().trim().min(1, 'Your name is required').max(200),
  company_name: z.string().trim().min(1, 'Business name is required').max(300),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export const businessChangePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters').max(200),
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

export const extendAccessSchema = z
  .object({
    days: z.number().int().min(1).max(365).optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .refine((v) => v.days != null || v.expiresAt != null, {
    message: 'Either days or expiresAt is required',
    path: ['days'],
  });

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type BusinessLoginInput = z.infer<typeof businessLoginSchema>;
export type BusinessSignupInput = z.infer<typeof businessSignupSchema>;
export type BusinessChangePasswordInput = z.infer<typeof businessChangePasswordSchema>;
export type RequestAccessInput = z.infer<typeof requestAccessSchema>;
export type AssignCategoriesInput = z.infer<typeof assignCategoriesSchema>;
export type ShareProfilesInput = z.infer<typeof shareProfilesSchema>;
export type ExtendAccessInput = z.infer<typeof extendAccessSchema>;
