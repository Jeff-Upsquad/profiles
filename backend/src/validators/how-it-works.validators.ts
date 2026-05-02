import { z } from 'zod';

const loomUrlRegex = /^https:\/\/(www\.)?loom\.com\/share\/[\w-]+/;

export const createHowItWorksVideoSchema = z.object({
  language: z.string().min(1, 'Language is required').max(10),
  loom_url: z
    .string()
    .url('Must be a valid URL')
    .refine((url) => loomUrlRegex.test(url), 'Must be a valid Loom share URL'),
  is_active: z.boolean().optional(),
});

export const updateHowItWorksVideoSchema = z.object({
  language: z.string().min(1).max(10).optional(),
  loom_url: z
    .string()
    .url('Must be a valid URL')
    .refine((url) => loomUrlRegex.test(url), 'Must be a valid Loom share URL')
    .optional(),
  is_active: z.boolean().optional(),
});

export type CreateHowItWorksVideoInput = z.infer<typeof createHowItWorksVideoSchema>;
export type UpdateHowItWorksVideoInput = z.infer<typeof updateHowItWorksVideoSchema>;
