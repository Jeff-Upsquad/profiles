import { z } from 'zod';

// Require complete business and location details here; SquadHub also applies its
// canonical schemas. Only authenticated identity is forwarded for ownership.
export const profileKindSchema = z.enum(['business', 'brand', 'job', 'location']);
export const hiringProfileSaveSchema = z.object({ id: z.string().uuid(), data: z.record(z.unknown()) });
const requiredText = (label: string, max: number) => z.string().trim().min(1, `${label} is required.`).max(max);
export const businessProfileDetailsSchema = z.object({
  contact_name: requiredText('Contact name', 200),
  contact_email: requiredText('Contact email', 200).email(),
  contact_phone: requiredText('Contact phone', 30),
  name: requiredText('Business name', 200),
  about: requiredText('About the business', 8000),
  industry: requiredText('Industry', 200),
  company_size: requiredText('Company size', 50),
  website: requiredText('Business website', 500).url(),
  founded_year: z.number().int().min(1),
}).passthrough();
export const locationDetailsSchema = z.object({
  label: requiredText('Location name', 200),
  address: requiredText('Address', 1000),
  city: requiredText('City', 200),
  region: requiredText('State / region', 200),
}).passthrough();
export const jobBriefSchema = z.object({
  request_id: z.string().uuid(), job_profile_id: z.string().uuid(),
  category_name: z.string().trim().min(1).max(200),
  openings_count: z.number().int().min(1).max(500).default(1),
  expected_joining_date: z.string().date().optional(),
});
export type JobBriefInput = z.infer<typeof jobBriefSchema>;
