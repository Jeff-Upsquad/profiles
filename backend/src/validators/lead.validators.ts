import { z } from 'zod';

const phoneRegex = /^\+?[1-9]\d{9,14}$/;

export const creativeLeadSchema = z.object({
  form_type: z.literal('creative'),
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().regex(phoneRegex, 'Valid phone number is required'),
  email: z.string().email('Valid email is required'),
  role: z.enum(['Editor', 'Designer', 'Editor + Designer']),
  portfolio_link: z.string().url('Valid portfolio URL is required'),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
});

export const accountantLeadSchema = z.object({
  form_type: z.literal('accountant'),
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().regex(phoneRegex, 'Valid phone number is required'),
  email: z.string().email('Valid email is required'),
  age: z.number().int().min(16).max(100),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  native_place: z.string().min(1, 'Native place is required').max(200),
  district: z.array(z.string()).min(1, 'At least one district is required'),
  location: z.string().min(1, 'Location is required').max(200),
  work_type: z.enum(['Online', 'At Office', 'Hybrid']),
  education: z.string().min(1, 'Educational qualifications are required'),
  experience_years: z.string().min(1, 'Years of experience is required'),
  accounting_software: z.array(z.string()).min(1, 'At least one software is required'),
  addon_skills: z.array(z.string()).optional().default([]),
  current_salary: z.number().min(0, 'Current salary must be 0 or more'),
  expected_salary: z.number().min(0, 'Expected salary must be 0 or more'),
  languages: z.array(z.string()).min(1, 'At least one language is required'),
  experience_details: z.string().min(1, 'Experience details are required'),
  resume_url: z.string().url('Valid resume URL is required'),
  terms_accepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
});

export const createLeadSchema = z.discriminatedUnion('form_type', [
  creativeLeadSchema,
  accountantLeadSchema,
]);

export const updateLeadStatusSchema = z.object({
  status: z.enum(['new', 'contacted', 'converted', 'rejected']),
  admin_notes: z.string().optional(),
});

export type CreateCreativeLeadInput = z.infer<typeof creativeLeadSchema>;
export type CreateAccountantLeadInput = z.infer<typeof accountantLeadSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;
