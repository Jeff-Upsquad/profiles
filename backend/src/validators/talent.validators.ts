import { z } from 'zod';

export const createProfileSchema = z.object({
  category_id: z.string().uuid('Valid category ID is required'),
});

export const updateProfileSchema = z.object({
  field_data: z.record(z.string(), z.any()).optional(),
  resume_url: z.string().url('Must be a valid URL').optional(),
});

export const updateTalentUserSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  phone: z.string().optional(),
  age: z.number().int().min(16).max(100).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  native_place: z.string().max(200).optional(),
  preferred_districts: z.array(z.string()).optional(),
  current_location: z.string().max(200).optional(),
  languages_spoken: z.array(z.string()).optional(),
  profile_photo_url: z.string().url('Must be a valid URL').optional(),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateTalentUserInput = z.infer<typeof updateTalentUserSchema>;
