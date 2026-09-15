import { z } from 'zod';

// `loom_url` is the historic column name — it now accepts any playable video
// URL (YouTube, Vimeo, Loom, SquadClips, or a direct mp4/mov/webm file),
// matching the upsquad-site HeroMedia player capabilities.
const videoUrlRegex =
  /^https:\/\/(www\.)?(loom\.com\/(share|embed)\/|youtube\.com\/(watch|embed\/)|youtu\.be\/|vimeo\.com\/|player\.vimeo\.com\/video\/|clips\.squadhub\.in\/(share|embed)\/)/i;
const directFileRegex = /^https:\/\/.+\.(mp4|mov|webm|m3u8)(\?.*)?$/i;

function isPlayableVideoUrl(url: string): boolean {
  return videoUrlRegex.test(url) || directFileRegex.test(url);
}

const videoUrlField = z
  .string()
  .url('Must be a valid URL')
  .refine(
    (url) => isPlayableVideoUrl(url),
    'Must be a YouTube, Vimeo, Loom, SquadClips, or direct video file URL',
  );

export const createHowItWorksVideoSchema = z.object({
  language: z.string().min(1, 'Language is required').max(10),
  loom_url: videoUrlField,
  is_active: z.boolean().optional(),
});

export const updateHowItWorksVideoSchema = z.object({
  language: z.string().min(1).max(10).optional(),
  loom_url: videoUrlField.optional(),
  is_active: z.boolean().optional(),
});

export type CreateHowItWorksVideoInput = z.infer<typeof createHowItWorksVideoSchema>;
export type UpdateHowItWorksVideoInput = z.infer<typeof updateHowItWorksVideoSchema>;
