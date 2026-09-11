import { z } from 'zod';

/**
 * Training validators, SquadHire side.
 *
 * Content (titles, pages, blocks, videos, quizzes) is authored in SquadHub's
 * Resources module and arrives by sync, so there are no create/update schemas
 * for it here. What remains is the configuration SquadHire owns: publication,
 * targeting, the countdown, and the two locks.
 */

// ---------------------------------------------------------------------------
// Item configuration
// ---------------------------------------------------------------------------

export const updateItemSchema = z
  .object({
    is_active: z.boolean().optional(),
    is_onboarding: z.boolean().optional(),
    available_to_all: z.boolean().optional(),
    countdown_enabled: z.boolean().optional(),
    countdown_hours: z.number().int().positive().nullable().optional(),
    sort_order: z.number().int().min(0).optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    category_ids: z.array(z.string().uuid('Each category_id must be a valid UUID')).optional(),
  })
  .refine(
    (data) => !data.countdown_enabled || (data.countdown_hours != null && data.countdown_hours > 0),
    { message: 'Countdown duration is required when countdown is enabled', path: ['countdown_hours'] },
  );

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

/**
 * Point an existing course at the SquadHub Resources item that should own its
 * content from now on. Null unlinks it again.
 */
export const linkSquadhubItemSchema = z.object({
  squadhub_item_id: z.string().uuid('Enter the SquadHub item id or its editor link').nullable(),
});

export type LinkSquadhubItemInput = z.infer<typeof linkSquadhubItemSchema>;

// ---------------------------------------------------------------------------
// Page gating
// ---------------------------------------------------------------------------

// The talent-portal modules a page may gate. Kept as a closed list so a typo
// can't produce a lock that never opens.
const linkedModuleEnum = z.enum([
  'basic-profile',
  'profiles',
  'subscriptions',
  'assignments',
  'jobs',
  'settings',
  'notifications',
]);

export const updatePageConfigSchema = z.object({
  linked_module: linkedModuleEnum.nullable().optional(),
  gates_profile_creation: z.boolean().optional(),
  language: z.string().max(10).optional(),
  is_active: z.boolean().optional(),
});

export type UpdatePageConfigInput = z.infer<typeof updatePageConfigSchema>;

// ---------------------------------------------------------------------------
// Talent actions
// ---------------------------------------------------------------------------

export const submitQuizSchema = z.object({
  // { [question_id]: option_id }
  answers: z.record(z.string().uuid(), z.string().min(1).max(64)),
});

export type SubmitQuizInput = z.infer<typeof submitQuizSchema>;

export const requestReopenSchema = z.object({
  reason: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Sharing (unchanged — assignments still drive the Training badge)
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

export type ShareCourseInput = z.infer<typeof shareCourseSchema>;
