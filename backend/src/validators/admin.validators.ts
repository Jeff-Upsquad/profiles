import { z } from 'zod';

// ---------------------------------------------------------------------------
// Category schemas
// ---------------------------------------------------------------------------

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().max(500).optional(),
  icon_url: z.string().url().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon_url: z.string().url().optional().or(z.literal('')),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// Category field schemas
// ---------------------------------------------------------------------------

const fieldTypeEnum = z.enum([
  'text',
  'textarea',
  'number',
  'currency',
  'email',
  'phone',
  'select',
  'multi_select',
  'file_upload',
  'date',
  'experience',
]);

export const createFieldSchema = z.object({
  field_key: z.string().min(1, 'field_key is required').max(100),
  field_label: z.string().min(1, 'field_label is required').max(200),
  field_type: fieldTypeEnum,
  is_required: z.boolean().optional(),
  placeholder: z.string().max(300).optional(),
  helper_text: z.string().max(500).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  validation_rules: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      minLength: z.number().int().optional(),
      maxLength: z.number().int().optional(),
      pattern: z.string().optional(),
      maxFileSize: z.number().optional(),
      allowedFileTypes: z.array(z.string()).optional(),
    })
    .optional(),
});

export const updateFieldSchema = z.object({
  field_key: z.string().min(1).max(100).optional(),
  field_label: z.string().min(1).max(200).optional(),
  field_type: fieldTypeEnum.optional(),
  is_required: z.boolean().optional(),
  placeholder: z.string().max(300).optional(),
  helper_text: z.string().max(500).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  validation_rules: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      minLength: z.number().int().optional(),
      maxLength: z.number().int().optional(),
      pattern: z.string().optional(),
      maxFileSize: z.number().optional(),
      allowedFileTypes: z.array(z.string()).optional(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Field option schemas
// ---------------------------------------------------------------------------

export const createOptionSchema = z.object({
  label: z.string().min(1, 'Label is required').max(200),
  value: z.string().min(1, 'Value is required').max(200),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const updateOptionSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  value: z.string().min(1).max(200).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Reorder schema
// ---------------------------------------------------------------------------

export const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid('Each item id must be a valid UUID'),
        sort_order: z.number().int().min(0),
      })
    )
    .min(1, 'At least one item is required'),
});

// ---------------------------------------------------------------------------
// Pagination schema (applied to query params)
// ---------------------------------------------------------------------------

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Talent profile tier
// ---------------------------------------------------------------------------

export const setProfileTierSchema = z
  .object({
    tier: z.enum(['junior', 'pro', 'elite', 'Top Talents', 'custom']).nullable(),
    tier_custom: z.string().max(100).optional().nullable(),
  })
  .refine(
    (data) =>
      data.tier !== 'custom' ||
      (!!data.tier_custom && data.tier_custom.trim().length > 0),
    { message: 'Custom tier label is required', path: ['tier_custom'] },
  );

// ---------------------------------------------------------------------------
// Onboarding bypass
// ---------------------------------------------------------------------------

// Lets an admin mark a talent as exempt from the onboarding training
// course. When skip_onboarding is true, the server treats the user as if
// they had completed onboarding (gates, lesson locks, module access, and
// the 5-stage progress strip all short-circuit on this flag).
export const setTalentOnboardingBypassSchema = z.object({
  skip_onboarding: z.boolean(),
  reason: z.string().max(500).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Admin: edit talent base profile + category profiles
// ---------------------------------------------------------------------------

// Mirrors talent's updateTalentUserSchema. Admin can rewrite any talent
// user's base info; status preservation is handled in the service layer.
export const adminUpdateTalentUserSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  phone: z.string().optional(),
  age: z.number().int().min(16).max(100).nullable().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).nullable().optional(),
  native_place: z.string().max(200).nullable().optional(),
  current_location: z.string().max(200).nullable().optional(),
  languages_spoken: z
    .array(z.object({ language: z.string(), proficiency: z.string() }))
    .optional(),
  profile_photo_url: z.string().url().nullable().optional(),
});

export const adminUpdateTalentProfileSchema = z.object({
  field_data: z.record(z.string(), z.any()).optional(),
  resume_url: z.string().url('Must be a valid URL').nullable().optional(),
});

export const adminAddPortfolioItemSchema = z.object({
  skill_name: z.string().min(1).max(200),
  file_url: z.string().url().optional(),
  file_type: z.enum(['image', 'pdf', 'video']),
  file_name: z.string().min(1).max(500),
  source_type: z.enum(['upload', 'link']).optional(),
  provider: z.string().optional(),
  external_url: z.string().url().optional(),
  embed_url: z.string().url().optional(),
  category_name: z.string().max(200).nullable().optional(),
});

export const adminReviewPortfolioItemSchema = z.object({
  admin_is_active: z.boolean().optional(),
  admin_comment: z.string().max(1000).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateFieldInput = z.infer<typeof createFieldSchema>;
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;
export type CreateOptionInput = z.infer<typeof createOptionSchema>;
export type UpdateOptionInput = z.infer<typeof updateOptionSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SetProfileTierInput = z.infer<typeof setProfileTierSchema>;
export type AdminUpdateTalentUserInput = z.infer<typeof adminUpdateTalentUserSchema>;
export type AdminUpdateTalentProfileInput = z.infer<typeof adminUpdateTalentProfileSchema>;
export type AdminAddPortfolioItemInput = z.infer<typeof adminAddPortfolioItemSchema>;
export type AdminReviewPortfolioItemInput = z.infer<typeof adminReviewPortfolioItemSchema>;
export type SetTalentOnboardingBypassInput = z.infer<typeof setTalentOnboardingBypassSchema>;
