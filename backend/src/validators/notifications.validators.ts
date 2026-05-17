import { z } from 'zod';

const loomUrlRegex = /^https:\/\/(www\.)?loom\.com\/(share|embed)\/[\w-]+/;

export const mediaItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('image'),
    url: z.string().url(),
    name: z.string().optional(),
  }),
  z.object({
    type: z.literal('pdf'),
    url: z.string().url(),
    name: z.string().optional(),
  }),
  z.object({
    type: z.literal('loom'),
    url: z
      .string()
      .url()
      .refine((u) => loomUrlRegex.test(u), 'Must be a Loom share or embed URL'),
    name: z.string().optional(),
  }),
]);

export const targetFiltersSchema = z
  .object({
    approval_status: z.array(z.enum(['pending', 'approved', 'rejected'])).optional(),
    is_active: z.boolean().optional(),
    gender: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    location_contains: z.string().trim().min(1).optional(),
  })
  .strict();

export const createNotificationSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    body: z.string().trim().max(5000).optional().or(z.literal('')),
    media: z.array(mediaItemSchema).max(20).default([]),
    filters: targetFiltersSchema.default({}),
  })
  .refine((v) => !!v.body?.trim() || (v.media && v.media.length > 0), {
    message: 'Notification must have body text or at least one media item',
    path: ['body'],
  });

export const previewFiltersSchema = z.object({
  filters: targetFiltersSchema.default({}),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type TargetFilters = z.infer<typeof targetFiltersSchema>;
export type MediaItem = z.infer<typeof mediaItemSchema>;
