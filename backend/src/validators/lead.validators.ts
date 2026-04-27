import { z } from 'zod';

// Indian mobile: optional "+91" prefix + exactly 10 digits starting with 6–9.
const phoneRegex = /^(\+?91)?[6-9]\d{9}$/;

const workTypeSeekingSchema = z
  .array(z.enum(['Freelance work', 'Full Time Job', 'Part Time Job']))
  .min(1, 'Select at least one work type you are looking for');

export const creativeLeadSchema = z.object({
  form_type: z.literal('creative'),
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().regex(phoneRegex, 'Valid phone number is required'),
  email: z.string().email('Valid email is required'),
  age: z.number().int().min(16).max(100),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  country: z.string().min(1, 'Country is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  current_district: z.string().min(1, 'District is required').max(100),
  role: z.array(z.enum(['Editor', 'Designer', 'Editor + Designer'])).min(1, 'At least one role is required'),
  work_type_seeking: workTypeSeekingSchema,
  experience_years: z.string().min(1, 'Years of experience is required'),
  portfolio_link: z.string().url('Valid portfolio URL is required'),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
});

export const accountantLeadSchema = z.object({
  form_type: z.literal('accountant'),
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().regex(phoneRegex, 'Valid phone number is required'),
  email: z.string().email('Valid email is required'),
  age: z.number().int().min(16).max(100),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  country: z.string().min(1, 'Country is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  current_district: z.string().min(1, 'District is required').max(100),
  native_place: z.string().min(1, 'Native place is required').max(200),
  district: z.array(z.string()).min(1, 'At least one district is required'),
  location: z.string().min(1, 'Location is required').max(200),
  work_type: z.array(z.enum(['Online', 'At Office', 'Hybrid'])).min(1, 'At least one work type is required'),
  work_type_seeking: workTypeSeekingSchema,
  education: z.string().min(1, 'Educational qualifications are required'),
  experience_years: z.string().min(1, 'Years of experience is required'),
  accounting_software: z.array(z.string()).min(1, 'At least one software is required'),
  addon_skills: z.array(z.string()).optional().default([]),
  current_salary: z.number().min(0, 'Current salary must be 0 or more'),
  expected_salary: z.number().min(0, 'Expected salary must be 0 or more'),
  languages: z.array(z.string()).min(1, 'At least one language is required'),
  experience_details: z.string().min(1, 'Experience details are required'),
  resume_url: z.string().url('Valid resume URL is required').optional().or(z.literal('')),
  terms_accepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
});

export const createLeadSchema = z.discriminatedUnion('form_type', [
  creativeLeadSchema,
  accountantLeadSchema,
]);

export const checkExistingContactSchema = z
  .object({
    email: z.string().trim().email('Valid email is required').optional(),
    phone: z.string().trim().min(1).optional(),
  })
  .refine((data) => !!data.email || !!data.phone, {
    message: 'email or phone is required',
  });

export const LEAD_STATUS_VALUES = [
  'new',
  'under_review',
  'shortlisted',
  'partner_onboarding',
  'onboard_completed',
  'archived',
  // legacy values kept for backward compatibility with pre-existing rows
  'contacted',
  'converted',
  'rejected',
] as const;

export const ARCHIVE_REASON_VALUES = [
  'not_qualified',
  'not_responsive',
  'not_interested',
  'duplicate',
  'spam',
  'other',
] as const;

export const PROFILE_TYPE_VALUES = ['junior', 'pro', 'elite', 'custom'] as const;

export const updateLeadStatusSchema = z
  .object({
    status: z.enum(LEAD_STATUS_VALUES),
    admin_notes: z.string().optional(),
    archive_reason: z.enum(ARCHIVE_REASON_VALUES).optional(),
  })
  .refine(
    (data) => data.status !== 'archived' || !!data.archive_reason,
    { message: 'archive_reason is required when status is archived', path: ['archive_reason'] }
  )
  .refine(
    (data) => data.status !== 'archived' || (!!data.admin_notes && data.admin_notes.trim().length > 0),
    { message: 'A note is required when archiving', path: ['admin_notes'] }
  );

export const updateLeadProfileTypeSchema = z
  .object({
    profile_type: z.enum(PROFILE_TYPE_VALUES).nullable(),
    profile_type_custom: z.string().max(100).optional().nullable(),
  })
  .refine(
    (data) =>
      data.profile_type !== 'custom' ||
      (!!data.profile_type_custom && data.profile_type_custom.trim().length > 0),
    { message: 'Custom profile type label is required', path: ['profile_type_custom'] }
  );

export const createLeadNoteSchema = z.object({
  content: z.string().trim().min(1, 'Note cannot be empty').max(5000),
});

export const updateLeadNoteSchema = z.object({
  content: z.string().trim().min(1, 'Note cannot be empty').max(5000),
});

export type CreateCreativeLeadInput = z.infer<typeof creativeLeadSchema>;
export type CreateAccountantLeadInput = z.infer<typeof accountantLeadSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;
export type UpdateLeadProfileTypeInput = z.infer<typeof updateLeadProfileTypeSchema>;
export type CreateLeadNoteInput = z.infer<typeof createLeadNoteSchema>;
export type UpdateLeadNoteInput = z.infer<typeof updateLeadNoteSchema>;
export type CheckExistingContactInput = z.infer<typeof checkExistingContactSchema>;
