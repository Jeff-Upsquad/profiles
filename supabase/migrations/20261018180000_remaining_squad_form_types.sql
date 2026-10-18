-- Commit enum values before the following category migration.
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'seo_specialist';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'digital_marketing_team';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'influencer_marketing';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'offline_marketing';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'web_development';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'app_building';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'automation';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'software_solutions';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'cfo_ca';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'gst_experts';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'tds_experts';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'labour_law';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'incorporation';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'contract_drafting';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'ip_protection';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'compliance';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'business_formation';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'end_to_end_hiring';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'team_building';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'hr_process';

-- Compatibility with the already-deployed split profile categories.
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'videographer';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'photographer';
