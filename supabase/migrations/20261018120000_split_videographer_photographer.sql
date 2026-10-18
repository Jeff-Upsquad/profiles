-- Split Videographer / Photographer into two separate categories: Videographer and Photographer.
-- Additive and repeatable.

ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'videographer';
ALTER TYPE public.lead_form_type_enum ADD VALUE IF NOT EXISTS 'photographer';

ALTER TABLE talent_users DROP CONSTRAINT IF EXISTS talent_users_signup_form_type_check;
ALTER TABLE talent_users ADD CONSTRAINT talent_users_signup_form_type_check CHECK (
  signup_form_type IS NULL OR signup_form_type IN (
    'creative', 'accountant', 'sales',
    'creative_director', 'copy_content_writer', 'social_media_manager',
    'videographer', 'photographer', 'videographer_photographer',
    'ai_video_image_creator', 'ads_specialist'
  )
);

-- 1. Videographer category
UPDATE categories
SET name = 'Videographer',
    slug = 'videographer',
    description = 'Brand films, product videos, event coverage and commercial video production.'
WHERE slug = 'videographer-photographer' OR id = 'ca148001-5800-4800-8800-000000000004'::uuid;

INSERT INTO categories(id, name, slug, description, is_active, sort_order)
VALUES ('ca148001-5800-4800-8800-000000000004'::uuid, 'Videographer', 'videographer', 'Brand films, product videos, event coverage and commercial video production.', TRUE, 90)
ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, is_active=TRUE;

INSERT INTO public_forms(form_type, title, description, url_path, enabled)
VALUES ('videographer', 'Videographer', 'Brand films, product videos, event coverage and commercial video production.', '/apply/videographer', TRUE)
ON CONFLICT (form_type) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, url_path=EXCLUDED.url_path, enabled=TRUE;

INSERT INTO category_fields(category_id, field_key, field_label, field_type, is_required, helper_text, sort_order, is_active, validation_rules)
SELECT id, 'professional_title', 'Professional title', 'text'::field_type_enum, TRUE, 'Use a clear title for the work you do.', 10, TRUE, '{"minLength": 3, "maxLength": 120}'::jsonb
FROM categories WHERE slug='videographer' ON CONFLICT (category_id, field_key) DO NOTHING;

INSERT INTO category_fields(category_id, field_key, field_label, field_type, is_required, helper_text, sort_order, is_active, validation_rules)
SELECT id, 'professional_summary', 'Professional summary', 'textarea'::field_type_enum, TRUE, 'Describe your strengths, industries and the outcomes you deliver.', 20, TRUE, '{"minLength": 40, "maxLength": 1200}'::jsonb
FROM categories WHERE slug='videographer' ON CONFLICT (category_id, field_key) DO NOTHING;

INSERT INTO category_fields(category_id, field_key, field_label, field_type, is_required, helper_text, sort_order, is_active, validation_rules)
SELECT id, 'equipment_and_travel', 'Equipment, production setup and travel', 'textarea'::field_type_enum, FALSE, 'List camera, audio, lighting and crew capabilities, your shooting locations and travel availability.', 30, TRUE, '{"maxLength": 1200}'::jsonb
FROM categories WHERE slug='videographer' ON CONFLICT (category_id, field_key) DO NOTHING;

-- Template categories (genres) for Videographer
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Brand films', 10, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Product videos', 20, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Events', 30, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Interviews', 40, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Social video shoots', 50, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Commercials', 60, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Documentaries', 70, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Music videos', 80, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;

-- Template skill sets for Videographer
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'Camera operation', 10, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'Lighting', 20, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'Composition', 30, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'Audio recording', 40, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'Shot planning', 50, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'On-set direction', 60, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'Color grading', 70, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'Production coordination', 80, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;

-- Template tools for Videographer
INSERT INTO template_tools(category_id, name, sort_order, is_active) SELECT id, 'DaVinci Resolve', 10, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_tools(category_id, name, sort_order, is_active) SELECT id, 'Adobe Premiere Pro', 20, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_tools(category_id, name, sort_order, is_active) SELECT id, 'Final Cut Pro', 30, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_tools(category_id, name, sort_order, is_active) SELECT id, 'Frame.io', 40, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_tools(category_id, name, sort_order, is_active) SELECT id, 'After Effects', 50, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;

-- Template AI tools for Videographer
INSERT INTO template_ai_tools(category_id, name, sort_order, is_active) SELECT id, 'Runway', 10, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_ai_tools(category_id, name, sort_order, is_active) SELECT id, 'Topaz Video AI', 20, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_ai_tools(category_id, name, sort_order, is_active) SELECT id, 'Adobe Firefly', 30, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_ai_tools(category_id, name, sort_order, is_active) SELECT id, 'Kling', 40, TRUE FROM categories WHERE slug='videographer' ON CONFLICT (category_id, name) DO NOTHING;

-- Interview questions for Videographer
INSERT INTO interview_questions(form_type, question_text, field_type, is_required, display_order)
SELECT 'videographer', x.question, 'textarea', TRUE, x.ord FROM (VALUES
  ('Tell us about one Videographer project: your responsibilities, process and results.', 0),
  ('List camera, audio, lighting and crew capabilities, your shooting locations and travel availability.', 1),
  ('How do you handle a brief, feedback and delivery deadlines?', 2)
) x(question, ord)
WHERE NOT EXISTS(SELECT 1 FROM interview_questions WHERE form_type='videographer');


-- 2. Photographer category
INSERT INTO categories(id, name, slug, description, is_active, sort_order)
VALUES ('ca148001-5800-4800-8800-000000000006'::uuid, 'Photographer', 'photographer', 'Brand, product, event, portrait and commercial photography.', TRUE, 95)
ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, is_active=TRUE;

INSERT INTO public_forms(form_type, title, description, url_path, enabled)
VALUES ('photographer', 'Photographer', 'Brand, product, event, portrait and commercial photography.', '/apply/photographer', TRUE)
ON CONFLICT (form_type) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, url_path=EXCLUDED.url_path, enabled=TRUE;

INSERT INTO category_fields(category_id, field_key, field_label, field_type, is_required, helper_text, sort_order, is_active, validation_rules)
SELECT id, 'professional_title', 'Professional title', 'text'::field_type_enum, TRUE, 'Use a clear title for the work you do.', 10, TRUE, '{"minLength": 3, "maxLength": 120}'::jsonb
FROM categories WHERE slug='photographer' ON CONFLICT (category_id, field_key) DO NOTHING;

INSERT INTO category_fields(category_id, field_key, field_label, field_type, is_required, helper_text, sort_order, is_active, validation_rules)
SELECT id, 'professional_summary', 'Professional summary', 'textarea'::field_type_enum, TRUE, 'Describe your strengths, industries and the outcomes you deliver.', 20, TRUE, '{"minLength": 40, "maxLength": 1200}'::jsonb
FROM categories WHERE slug='photographer' ON CONFLICT (category_id, field_key) DO NOTHING;

INSERT INTO category_fields(category_id, field_key, field_label, field_type, is_required, helper_text, sort_order, is_active, validation_rules)
SELECT id, 'equipment_and_travel', 'Equipment, production setup and travel', 'textarea'::field_type_enum, FALSE, 'List camera, lenses, lighting and studio capabilities, your shooting locations and travel availability.', 30, TRUE, '{"maxLength": 1200}'::jsonb
FROM categories WHERE slug='photographer' ON CONFLICT (category_id, field_key) DO NOTHING;

-- Template categories (genres) for Photographer
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Product photography', 10, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Portraits', 20, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Events', 30, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Food photography', 40, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Real estate', 50, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Fashion photography', 60, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Editorial', 70, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_categories(category_id, name, sort_order, is_active) SELECT id, 'Architecture', 80, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;

-- Template skill sets for Photographer
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'Camera operation', 10, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'Studio lighting', 20, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'Natural lighting', 30, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'Composition', 40, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'Photo retouching', 50, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'Color correction', 60, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'On-set direction', 70, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_skill_sets(category_id, name, sort_order, is_active) SELECT id, 'Location scouting', 80, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;

-- Template tools for Photographer
INSERT INTO template_tools(category_id, name, sort_order, is_active) SELECT id, 'Adobe Lightroom', 10, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_tools(category_id, name, sort_order, is_active) SELECT id, 'Adobe Photoshop', 20, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_tools(category_id, name, sort_order, is_active) SELECT id, 'Capture One', 30, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;

-- Template AI tools for Photographer
INSERT INTO template_ai_tools(category_id, name, sort_order, is_active) SELECT id, 'Adobe Firefly', 10, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_ai_tools(category_id, name, sort_order, is_active) SELECT id, 'Photoshop Generative Fill', 20, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_ai_tools(category_id, name, sort_order, is_active) SELECT id, 'Topaz Photo AI', 30, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;
INSERT INTO template_ai_tools(category_id, name, sort_order, is_active) SELECT id, 'Midjourney', 40, TRUE FROM categories WHERE slug='photographer' ON CONFLICT (category_id, name) DO NOTHING;

-- Interview questions for Photographer
INSERT INTO interview_questions(form_type, question_text, field_type, is_required, display_order)
SELECT 'photographer', x.question, 'textarea', TRUE, x.ord FROM (VALUES
  ('Tell us about one Photography project: your responsibilities, process and results.', 0),
  ('List camera, lenses, lighting and studio capabilities, your shooting locations and travel availability.', 1),
  ('How do you handle a brief, feedback and delivery deadlines?', 2)
) x(question, ord)
WHERE NOT EXISTS(SELECT 1 FROM interview_questions WHERE form_type='photographer');
