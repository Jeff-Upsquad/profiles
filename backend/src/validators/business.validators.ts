import { z } from 'zod';

export const updateBusinessUserSchema = z.object({
  company_name: z.string().min(1).max(200).optional(),
  company_website: z.string().url().max(500).optional().or(z.literal('')),
  industry: z.string().max(200).optional(),
  company_size: z
    .enum(['1-10', '11-50', '51-200', '201-500', '500+'])
    .optional(),
  contact_person_name: z.string().min(1).max(200).optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  contact_phone: z.string().max(30).optional(),
});

export const discoverQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  district: z.string().max(200).optional(),
  min_salary: z.coerce.number().min(0).optional(),
  max_salary: z.coerce.number().min(0).optional(),
  min_experience: z.coerce.number().min(0).optional(),
  max_experience: z.coerce.number().min(0).optional(),
  sort_by: z
    .enum(['newest', 'experience_high', 'experience_low', 'salary_low', 'salary_high'])
    .default('newest'),
});

export const sendInterestSchema = z.object({
  message: z.string().min(1).max(2000),
});

export type UpdateBusinessUserInput = z.infer<typeof updateBusinessUserSchema>;
export type DiscoverQueryInput = z.infer<typeof discoverQuerySchema>;
export type SendInterestInput = z.infer<typeof sendInterestSchema>;
