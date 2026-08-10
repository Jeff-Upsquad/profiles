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
    (data) =>
      !data.is_onboarding ||
      data.available_to_all ||
      (data.category_ids && data.category_ids.length > 0),
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

// Training lesson videos may be hosted on Loom or on SquadClips
// (clips.squadhub.in). Both expose a `/share/<token>` link that the talent
// player turns into an `/embed/<token>` iframe.
const loomUrlRegex = /^https:\/\/(www\.)?loom\.com\/share\/[\w-]+/;
const squadClipsUrlRegex = /^https:\/\/clips\.squadhub\.in\/share\/[\w-]+/;
const isSupportedVideoUrl = (url: string) =>
  loomUrlRegex.test(url) || squadClipsUrlRegex.test(url);

const lessonVideoSchema = z.object({
  language: z.string().min(1).max(10),
  loom_url: z
    .string()
    .url('Must be a valid URL')
    .refine(isSupportedVideoUrl, 'Must be a valid Loom or SquadClips share URL'),
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
// Share / assignments
// ---------------------------------------------------------------------------

export const shareCourseSchema = z
  .object({
    available_to_all: z.boolean().optional(),
    category_ids: z.array(z.string().uuid()).optional(),
    notify: z.boolean().optional(),
    reack: z.boolean().optional(),
    title: z.string().max(200).optional(),
    body: z.string().max(1000).optional(),
  })
  .refine(
    (data) => data.available_to_all || (data.category_ids && data.category_ids.length > 0),
    { message: 'Select at least one job profile or Everyone', path: ['category_ids'] },
  );

export const previewShareAudienceSchema = z
  .object({
    available_to_all: z.boolean().optional(),
    category_ids: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (data) => data.available_to_all || (data.category_ids && data.category_ids.length > 0),
    { message: 'Select at least one job profile or Everyone', path: ['category_ids'] },
  );

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type ShareCourseInput = z.infer<typeof shareCourseSchema>;

// ---------------------------------------------------------------------------
// SOP schemas
// ---------------------------------------------------------------------------

export const createSopSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(2000).optional(),
  icon: z.string().max(16).optional(),
  cover_image_url: z.string().url().optional().or(z.literal('')),
  available_to_all: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  category_ids: z.array(z.string().uuid()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export const updateSopSchema = createSopSchema.partial().extend({
  summary: z.string().max(2000).nullable().optional(),
  icon: z.string().max(16).nullable().optional(),
  cover_image_url: z.string().url().nullable().optional().or(z.literal('')),
});

export const createSopPageSchema = z.object({
  title: z.string().min(1).max(200),
  parent_page_id: z.string().uuid().nullable().optional(),
  icon: z.string().max(16).nullable().optional(),
  position: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const updateSopPageSchema = createSopPageSchema.partial();

export const createSopBlockSchema = z.object({
  type: z.enum(['text', 'image', 'video_embed', 'pdf']),
  position: z.number().int().min(0).optional(),
  text_content: z.unknown().optional(),
  file_url: z.string().nullable().optional(),
  file_name: z.string().nullable().optional(),
  file_size: z.number().int().nullable().optional(),
  mime_type: z.string().nullable().optional(),
  embed_url: z.string().nullable().optional(),
  embed_provider: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateSopBlockSchema = createSopBlockSchema.partial();

export const reorderSopPagesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().int().min(0),
      parent_page_id: z.string().uuid().nullable().optional(),
    }),
  ),
});

export const reorderSopBlocksSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().int().min(0),
    }),
  ),
});
