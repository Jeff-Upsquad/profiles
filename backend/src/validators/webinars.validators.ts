import { z } from 'zod';

export const createWebinarSchema = z.object({
  title: z.string().trim().min(1).max(200),
  starts_at: z.string().datetime({ offset: true }),
  language: z.string().trim().min(1).max(20).default('en'),
  meeting_link: z.string().trim().min(1).max(2000),
  audience: z.enum(['all', 'thailand']).default('thailand'),
  status: z.enum(['draft', 'published', 'cancelled', 'completed']).default('published'),
});

export type CreateWebinarInput = z.infer<typeof createWebinarSchema>;

export const updateWebinarSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  starts_at: z.string().datetime({ offset: true }).optional(),
  language: z.string().trim().min(1).max(20).optional(),
  meeting_link: z.string().trim().min(1).max(2000).optional(),
  audience: z.enum(['all', 'thailand']).optional(),
  status: z.enum(['draft', 'published', 'cancelled', 'completed']).optional(),
});

export type UpdateWebinarInput = z.infer<typeof updateWebinarSchema>;

export const rescheduleWebinarSchema = z.object({
  starts_at: z.string().datetime({ offset: true }),
  meeting_link: z.string().trim().max(2000).optional(),
  notify: z.boolean().default(true),
});

export type RescheduleWebinarInput = z.infer<typeof rescheduleWebinarSchema>;
