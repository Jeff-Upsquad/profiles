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
  current_location: z.string().max(200).optional(),
  languages_spoken: z.array(z.string()).optional(),
  profile_photo_url: z.string().url('Must be a valid URL').optional(),
});

export const updateBasicProfileSchema = z.object({
  // Section 2: Contact Details
  permanent_address: z.string().max(500).optional(),
  current_address: z.string().max(500).optional(),
  current_district: z.string().max(200).optional(),
  city: z.string().max(200).optional(),
  pin_code: z.string().regex(/^\d{6}$/, 'PIN code must be 6 digits').optional(),

  // Section 3: Job Preferences
  availability: z.array(z.enum(['full_time', 'part_time'])).optional(),
  job_type: z.array(z.enum(['remote', 'office', 'hybrid', 'field'])).optional(),

  // Section 4: ID Proofs
  aadhaar_number: z.string().regex(/^\d{12}$/, 'Aadhaar number must be 12 digits').optional(),
  aadhaar_file_url: z.string().url().optional(),
  pan_number: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Invalid PAN format (e.g. ABCDE1234F)').optional(),
  pan_file_url: z.string().url().optional(),

  // Section 5: Profile Picture
  profile_picture_url: z.string().url().optional(),

  // Section 6: Bank Account Details
  bank_account_holder: z.string().max(200).optional(),
  bank_name: z.string().max(200).optional(),
  bank_account_number: z.string().max(30).optional(),
  bank_ifsc_code: z.string().max(20).optional(),
  bank_branch_name: z.string().max(200).optional(),

  // Section 7: Resume
  resume_url: z.string().url().optional(),

  // Section 8: Expected Salary
  expected_salary_monthly: z.number().int().min(0).optional(),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateTalentUserInput = z.infer<typeof updateTalentUserSchema>;
export type UpdateBasicProfileInput = z.infer<typeof updateBasicProfileSchema>;
