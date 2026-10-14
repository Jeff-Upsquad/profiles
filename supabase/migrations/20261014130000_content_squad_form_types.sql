-- Commit these enum additions before the category seed migration.
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'creative_director';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'copy_content_writer';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'social_media_manager';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'videographer_photographer';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'ai_video_image_creator';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'ads_specialist';
