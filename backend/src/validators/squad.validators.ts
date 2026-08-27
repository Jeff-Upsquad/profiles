import { z } from 'zod';

export const createSquadInviteSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email('Valid email is required'),
  role_type: z.enum(['member','manager']).default('member'),
}).passthrough();

export const squadSignupSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const updateSquadMemberSelfSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  role_title: z.string().max(200).nullable().optional(),
  phone: z.string().nullable().optional(),
  age: z.number().int().min(16).max(100).nullable().optional(),
  gender: z.enum(['male','female','other','prefer_not_to_say']).nullable().optional(),
  current_location: z.string().max(300).nullable().optional(),
  languages_spoken: z.array(z.object({ language: z.string(), proficiency: z.string() })).nullable().optional(),
  experience_years: z.number().int().min(0).max(50).nullable().optional(),
  experience_months: z.number().int().min(0).max(11).nullable().optional(),
  skills: z.array(z.string()).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  profile_photo_url: z.string().url().nullable().optional(),
});

export const createSquadJobProfileSchema = z.object({
  category_id: z.string().uuid(),
  field_data: z.record(z.string(), z.any()).optional(),
});

export type CreateSquadInviteInput = z.infer<typeof createSquadInviteSchema>;
export type SquadSignupInput = z.infer<typeof squadSignupSchema>;
export type UpdateSquadMemberSelfInput = z.infer<typeof updateSquadMemberSelfSchema>;
