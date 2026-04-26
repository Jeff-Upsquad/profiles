import { z } from 'zod';
import { MAX_UPLOAD_BYTES } from '../config/upload.js';

export const presignSchema = z.object({
  fileName: z.string().min(1, 'fileName is required').max(500),
  contentType: z.string().min(1, 'contentType is required'),
  folder: z.string().max(100).optional(),
  // Optional but strongly recommended — when provided, R2 will reject any
  // PUT whose actual Content-Length differs (the SDK signs the header).
  contentLength: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, `File exceeds the ${MAX_UPLOAD_BYTES} byte limit`)
    .optional(),
});

export type PresignInput = z.infer<typeof presignSchema>;
