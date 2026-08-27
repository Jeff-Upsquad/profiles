import { z } from 'zod';

export const signupTalentSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(1, 'Full name is required').max(200),
  phone: z.string().optional(),
  country: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  current_district: z.string().max(100).optional(),
  age: z.number().int().min(16).max(100).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  native_place: z.string().max(200).optional(),
  current_location: z.string().max(200).optional(),
  languages_spoken: z.array(z.object({ language: z.string(), proficiency: z.string() })).optional(),
});

export const checkCandidateStatusSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
}).refine(d => d.email || d.phone, { message: 'Email or phone is required' });

export const signupBusinessSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  company_name: z.string().min(1, 'Company name is required').max(300),
  company_website: z.string().url().optional().or(z.literal('')),
  industry: z.string().max(200).optional(),
  company_size: z.enum(['1-10', '11-50', '51-200', '201-500', '500+']).optional(),
  contact_person_name: z.string().min(1, 'Contact person name is required').max(200),
  contact_email: z.string().email('Valid contact email is required'),
  contact_phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export const resetPasswordSchema = z.object({
  access_token: z.string().min(1, 'Access token is required'),
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const changePasswordSchema = z.object({
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Self-serve WhatsApp password reset (phone → temp password).
export const passwordResetLookupSchema = z.object({
  phone: z.string().min(6, 'Enter your registered WhatsApp number'),
});

export const passwordResetSendSchema = z.object({
  reset_ticket: z.string().min(1, 'Reset session is required'),
});

export const passwordResetVerifySchema = z.object({
  reset_ticket: z.string().min(1, 'Reset session is required'),
  temp_password: z.string().min(1, 'Temporary password is required'),
});

// ─── Authenticated login-detail change (WhatsApp code) ───────────────────────

export const loginUpdateSendSchema = z.object({
  field: z.enum(['email', 'phone', 'password']),
});

export const loginUpdateVerifySchema = z.object({
  ticket: z.string().min(1, 'Verification session is required'),
  code: z.string().min(1, 'Enter the code we sent to your WhatsApp'),
  new_value: z.string().min(1, 'A new value is required'),
});

export const signupAgencySchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  agency_name: z.string().min(1, 'Agency name is required').max(300),
  contact_person: z.string().max(200).optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  location: z.string().max(200).optional(),
});

export type SignupTalentInput = z.infer<typeof signupTalentSchema>;
export type SignupBusinessInput = z.infer<typeof signupBusinessSchema>;
export type SignupAgencyInput = z.infer<typeof signupAgencySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
