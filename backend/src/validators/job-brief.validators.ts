import { z } from 'zod';

// Profile fields are validated by SquadHub's canonical admin schemas. Profiles
// forwards only authenticated identity, never browser-supplied ownership.
export const profileKindSchema = z.enum(['business', 'brand', 'job', 'location']);
export const hiringProfileSaveSchema = z.object({ id: z.string().uuid(), data: z.record(z.unknown()) });
export const jobBriefSchema = z.object({
  request_id: z.string().uuid(), job_profile_id: z.string().uuid(),
  category_name: z.string().trim().min(1).max(200),
  openings_count: z.number().int().min(1).max(500).default(1),
  expected_joining_date: z.string().date().optional(),
});
export type JobBriefInput = z.infer<typeof jobBriefSchema>;
