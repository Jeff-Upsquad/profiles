import { z } from 'zod';

export const createProfileSchema = z.object({
  category_id: z.string().uuid('Valid category ID is required'),
  field_data: z.record(z.string(), z.any()).optional(),
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
  languages_spoken: z.array(z.object({ language: z.string(), proficiency: z.string() })).optional(),
  profile_photo_url: z.string().url('Must be a valid URL').optional(),
  whatsapp_subscription_updates_enabled: z.boolean().optional(),
});

export const updateBasicProfileSchema = z.object({
  // Section 2: Address
  // Official (permanent) address — matches ID proofs (Aadhaar, PAN).
  permanent_address: z.string().max(500).nullable().optional(),
  permanent_country: z.string().max(100).nullable().optional(),
  permanent_state: z.string().max(100).nullable().optional(),
  permanent_district: z.string().max(200).nullable().optional(),
  permanent_city: z.string().max(200).nullable().optional(),
  permanent_pin_code: z.string().regex(/^\d{6}$/, 'PIN code must be 6 digits').nullable().optional(),
  // Current address — where the talent lives now.
  current_address: z.string().max(500).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  current_district: z.string().max(200).nullable().optional(),
  city: z.string().max(200).nullable().optional(),
  pin_code: z.string().regex(/^\d{6}$/, 'PIN code must be 6 digits').nullable().optional(),

  // Section 3: Job Preferences
  availability: z.array(z.enum(['full_time', 'part_time'])).nullable().optional(),
  job_type: z.array(z.enum(['remote', 'office', 'hybrid', 'field'])).nullable().optional(),

  // Section 3b: Work Type (employment vs freelance) and freelance schedule
  employment_type: z.array(z.enum(['salary', 'freelance', 'partner_program'])).nullable().optional(),
  virtual_office_hours: z
    .array(
      z.object({
        day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
        from: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal('')),
        to: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal('')),
      })
    )
    .max(7)
    .nullable()
    .optional(),

  // Education & Courses
  education_courses: z
    .array(
      z.object({
        from_year: z.number().int().min(1980).max(2100),
        from_month: z.number().int().min(1).max(12),
        to_year: z.number().int().min(1980).max(2100),
        to_month: z.number().int().min(1).max(12),
        course_name: z.string().max(300),
        institution: z.string().max(300),
      })
    )
    .max(20)
    .nullable()
    .optional(),

  // Section 4: ID Proofs
  aadhaar_number: z.string().regex(/^\d{12}$/, 'Aadhaar number must be 12 digits').nullable().optional(),
  aadhaar_file_url: z.string().url().nullable().optional(),
  pan_number: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Invalid PAN format (e.g. ABCDE1234F)').nullable().optional(),
  pan_file_url: z.string().url().nullable().optional(),

  // Section 5: Profile Picture
  profile_picture_url: z.string().url().nullable().optional(),

  // Section 6: Bank Account Details
  bank_account_holder: z.string().max(200).nullable().optional(),
  bank_name: z.string().max(200).nullable().optional(),
  bank_account_number: z.string().max(30).nullable().optional(),
  bank_ifsc_code: z.string().max(20).nullable().optional(),
  bank_branch_name: z.string().max(200).nullable().optional(),

  // Section 7: Resume
  resume_url: z.string().url().nullable().optional(),

  // Section 8: Expected Salary
  expected_salary_monthly: z.number().int().min(0).nullable().optional(),
  expected_salary_full_time: z.number().int().min(0).nullable().optional(),
  expected_salary_part_time: z.number().int().min(0).nullable().optional(),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateTalentUserInput = z.infer<typeof updateTalentUserSchema>;
export type UpdateBasicProfileInput = z.infer<typeof updateBasicProfileSchema>;
