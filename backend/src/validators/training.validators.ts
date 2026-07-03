import { z } from 'zod';

// ---------------------------------------------------------------------------
// Course schemas
// ---------------------------------------------------------------------------

export const createCourseSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().max(2000).optional(),
    sort_order: z.number().int().min(0).optional(),
    is_active: z.boolean().optional(),
    is_onboarding: z.boolean().optional(),
    available_to_all: z.boolean().optional(),
    countdown_enabled: z.boolean().optional(),
    countdown_hours: z.number().int().positive().nullable().optional(),
    category_ids: z.array(z.string().uuid('Each category_id must be a valid UUID')).optional(),
  })
  .refine(
    (data) => !data.is_onboarding || (data.category_ids && data.category_ids.length > 0),
    { message: 'Onboarding courses require at least one category', path: ['category_ids'] },
  )
  .refine(
    (data) => !data.countdown_enabled || (data.countdown_hours != null && data.countdown_hours > 0),
    { message: 'Countdown duration is required when countdown is enabled', path: ['countdown_hours'] },
  );

export const updateCourseSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    sort_order: z.number().int().min(0).optional(),
    is_active: z.boolean().optional(),
    is_onboarding: z.boolean().optional(),
    available_to_all: z.boolean().optional(),
    countdown_enabled: z.boolean().optional(),
    countdown_hours: z.number().int().positive().nullable().optional(),
    category_ids: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (data) => !data.countdown_enabled || (data.countdown_hours != null && data.countdown_hours > 0),
    { message: 'Countdown duration is required when countdown is enabled', path: ['countdown_hours'] },
  );

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

// ---------------------------------------------------------------------------
// Chapter schemas
// ---------------------------------------------------------------------------

const linkedModuleEnum = z.enum([
  'basic-profile',
  'profiles',
  'subscriptions',
  'assignments',
  'jobs',
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
  gates_profile_creation: z.boolean().optional(),
  course_id: z.string().uuid().nullable().optional(),
  category_ids: z
    .array(z.string().uuid('Each category_id must be a valid UUID'))
    .min(1, 'At least one category is required')
    .optional(),
});

export const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  is_onboarding: z.boolean().optional(),
  language: z.string().max(10).optional(),
  linked_module: linkedModuleEnum.nullable().optional(),
  gates_profile_creation: z.boolean().optional(),
  course_id: z.string().uuid().nullable().optional(),
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
