import { z } from 'zod';

export const signupTalentSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(1, 'Full name is required').max(200),
  phone: z.string().optional(),
  age: z.number().int().min(16).max(100).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  native_place: z.string().max(200).optional(),
  preferred_districts: z.array(z.string()).optional(),
  current_location: z.string().max(200).optional(),
  languages_spoken: z.array(z.string()).optional(),
});

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

export type SignupTalentInput = z.infer<typeof signupTalentSchema>;
export type SignupBusinessInput = z.infer<typeof signupBusinessSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
