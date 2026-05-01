import { z } from 'zod';

// ---------------------------------------------------------------------------
// Chapter schemas
// ---------------------------------------------------------------------------

const linkedModuleEnum = z.enum([
  'basic-profile',
  'profiles',
  'subscriptions',
  'settings',
  'notifications',
]);

export const createChapterSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  is_onboarding: z.boolean().optional(),
  language: z.string().max(10).optional(),
  linked_module: linkedModuleEnum.nullable().optional(),
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
  linked_module: linkedModuleEnum.nullable().optional(),
  category_ids: z
    .array(z.string().uuid('Each category_id must be a valid UUID'))
    .min(1, 'At least one category is required')
    .optional(),
});

// ---------------------------------------------------------------------------
// Lesson schemas
// ---------------------------------------------------------------------------

const loomUrlRegex = /^https:\/\/(www\.)?loom\.com\/share\/[\w-]+/;

const lessonVideoSchema = z.object({
  language: z.string().min(1).max(10),
  loom_url: z
    .string()
    .url('Must be a valid URL')
    .refine((url) => loomUrlRegex.test(url), 'Must be a valid Loom share URL'),
});

export const createLessonSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  videos: z
    .array(lessonVideoSchema)
    .min(1, 'At least one language video is required')
    .refine(
      (videos) => new Set(videos.map((v) => v.language)).size === videos.length,
      'Each language can only appear once',
    ),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const updateLessonSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  videos: z
    .array(lessonVideoSchema)
    .min(1, 'At least one language video is required')
    .refine(
      (videos) => new Set(videos.map((v) => v.language)).size === videos.length,
      'Each language can only appear once',
    )
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
