import { z } from 'zod';

// ---------------------------------------------------------------------------
// Chapter schemas
// ---------------------------------------------------------------------------

export const createChapterSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  is_onboarding: z.boolean().optional(),
  language: z.string().max(10).optional(),
  category_ids: z
    .array(z.string().uuid('Each category_id must be a valid UUID'))
    .min(1, 'At least one category is required'),
});

export const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  is_onboarding: z.boolean().optional(),
  language: z.string().max(10).optional(),
  category_ids: z
    .array(z.string().uuid('Each category_id must be a valid UUID'))
    .min(1, 'At least one category is required')
    .optional(),
});

// ---------------------------------------------------------------------------
// Lesson schemas
// ---------------------------------------------------------------------------

const loomUrlRegex = /^https:\/\/(www\.)?loom\.com\/share\/[\w-]+/;

export const createLessonSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  loom_url: z
    .string()
    .url('Must be a valid URL')
    .refine((url) => loomUrlRegex.test(url), 'Must be a valid Loom share URL'),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const updateLessonSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  loom_url: z
    .string()
    .url('Must be a valid URL')
    .refine((url) => loomUrlRegex.test(url), 'Must be a valid Loom share URL')
    .optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
