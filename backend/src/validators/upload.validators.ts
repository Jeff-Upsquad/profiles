import { z } from 'zod';

export const presignSchema = z.object({
  fileName: z.string().min(1, 'fileName is required').max(500),
  contentType: z.string().min(1, 'contentType is required'),
  folder: z.string().max(100).optional(),
});

export type PresignInput = z.infer<typeof presignSchema>;
