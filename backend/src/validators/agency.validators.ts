import { z } from 'zod';

export const updateAgencyUserSchema = z.object({
  agency_name: z.string().min(1).max(300).optional(),
  agency_short_name: z.string().max(20).nullable().optional(),
  short_form: z.string().max(20).nullable().optional(),
  contact_person: z.string().max(200).nullable().optional(),
  contact_email: z.string().email().nullable().optional().or(z.literal('')),
  whatsapp_number: z.string().max(20).nullable().optional(),
  phone: z.string().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  location: z.string().max(300).nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
});

export const updateAgencyProfileSchema = z.object({
  tagline: z.string().max(300).nullable().optional(),
  about: z.string().max(5000).nullable().optional(),
  founded_year: z.number().int().min(1900).max(2100).nullable().optional(),
  team_size: z.string().max(50).nullable().optional(),
  services: z.array(z.string()).nullable().optional(),
  languages: z.array(z.string().max(50)).max(30).nullable().optional(),
  industries: z.array(z.string()).nullable().optional(),
  location_country: z.string().max(100).nullable().optional(),
  location_state: z.string().max(100).nullable().optional(),
  location_district: z.string().max(200).nullable().optional(),
  location_city: z.string().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').nullable().optional().or(z.literal('')),
  logo_url: z.string().url().nullable().optional(),
  agency_short_name: z.string().max(20).nullable().optional(),
  short_form: z.string().max(20).nullable().optional(),
});

export const createSquadMemberSchema = z.object({
  full_name: z.string().min(1).max(200),
  role_title: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  age: z.number().int().min(16).max(100).nullable().optional(),
  gender: z.enum(['male','female','other','prefer_not_to_say']).nullable().optional(),
  current_location: z.string().max(300).nullable().optional(),
  languages_spoken: z.array(z.object({ language: z.string(), proficiency: z.string() })).nullable().optional(),
  experience_years: z.number().int().min(0).max(50).nullable().optional(),
  experience_months: z.number().int().min(0).max(11).nullable().optional(),
  skills: z.array(z.string()).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  profile_photo_url: z.string().url().nullable().optional(),
  role_type: z.enum(['member','manager']).optional(),
  // Talent-like basic profile extensions for direct create (basic profile only)
  permanent_address: z.string().max(500).nullable().optional(),
  permanent_country: z.string().max(100).nullable().optional(),
  permanent_state: z.string().max(100).nullable().optional(),
  permanent_district: z.string().max(200).nullable().optional(),
  permanent_city: z.string().max(200).nullable().optional(),
  permanent_pin_code: z.string().max(10).nullable().optional(),
  education_courses: z.array(z.any()).nullable().optional(),
  experience: z.array(z.any()).nullable().optional(),
  // Working Days and Time — backend treats as partner_program (virtual_office_hours + daily_available_hours)
  virtual_office_hours: z.array(z.object({ day: z.enum(['mon','tue','wed','thu','fri','sat','sun']), from: z.string(), to: z.string() })).nullable().optional(),
  daily_available_hours: z.array(z.object({ day: z.enum(['mon','tue','wed','thu','fri','sat','sun']), hours: z.number().min(0).max(24) })).nullable().optional(),
}).passthrough();

export const updateSquadMemberSchema = createSquadMemberSchema.partial();

export const createAgencyMemberProfileSchema = z.object({
  squad_member_id: z.string().uuid(),
  category_id: z.string().uuid(),
  field_data: z.record(z.string(), z.any()).optional(),
});

export const updateAgencyMemberProfileSchema = z.object({
  field_data: z.record(z.string(), z.any()).optional(),
  status: z.enum(['draft','pending_review','approved','rejected','inactive']).optional(),
});

export const createAgencyGeneralPortfolioSchema = z.object({
  category_id: z.string().uuid(),
  field_data: z.record(z.string(), z.any()).optional(),
});

export const updateAgencyGeneralPortfolioSchema = z.object({
  field_data: z.record(z.string(), z.any()).optional(),
  status: z.enum(['draft','pending_review','approved','rejected','inactive']).optional(),
});

export const agencyPortfolioItemSchema = z.object({
  title: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  file_url: z.string().optional(),
  file_type: z.string().optional(),
  file_name: z.string().optional(),
  category_name: z.string().nullable().optional(),
  skill_name: z.string().optional(),
  provider: z.string().nullable().optional(),
  external_url: z.string().nullable().optional(),
  embed_url: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  source_type: z.enum(['upload','link']).optional(),
});

export type UpdateAgencyUserInput = z.infer<typeof updateAgencyUserSchema>;
export type UpdateAgencyProfileInput = z.infer<typeof updateAgencyProfileSchema>;
export type CreateSquadMemberInput = z.infer<typeof createSquadMemberSchema>;
export type UpdateSquadMemberInput = z.infer<typeof updateSquadMemberSchema>;
