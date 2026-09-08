-- 00138_ads_specialist_category.sql
-- Adds Ads Specialist as a first-class SquadHire talent profile category.
-- The stable UUID is also used by SquadHub's subscription mapping so a
-- submitted Ads Specialist brief is broadcast-ready without manual setup.

INSERT INTO categories (id, name, slug, description, is_active, sort_order)
VALUES (
  '6c46f5a5-8e38-4ed9-96f8-472fb2f0b0b1',
  'Ads Specialist',
  'ads-specialist',
  'Paid acquisition and performance marketing specialists across search, social, commerce, and emerging ad channels.',
  TRUE,
  50
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = TRUE,
  sort_order = EXCLUDED.sort_order;

-- Profile details shown by the standard talent profile builder.
WITH cat AS (SELECT id FROM categories WHERE slug = 'ads-specialist' LIMIT 1)
INSERT INTO category_fields (
  category_id, field_key, field_label, field_type, is_required,
  placeholder, helper_text, sort_order, is_active, validation_rules
)
SELECT cat.id, v.field_key, v.field_label, v.field_type::field_type_enum,
       v.is_required, v.placeholder, v.helper_text, v.sort_order, TRUE,
       v.validation_rules::jsonb
FROM cat
CROSS JOIN (VALUES
  ('professional_title', 'Professional title', 'text', TRUE,
   'e.g. Performance Marketing & Paid Ads Specialist',
   'Use a clear title that reflects the channels and outcomes you specialise in.',
   10, '{"minLength": 3, "maxLength": 120}'),
  ('professional_summary', 'Professional summary', 'textarea', TRUE,
   'Describe the campaigns you manage, the results you drive, and the kinds of businesses you help.',
   'Keep this outcome-focused so businesses can quickly understand your strengths.',
   20, '{"minLength": 40, "maxLength": 1200}'),
  ('campaign_results', 'Campaign results', 'textarea', FALSE,
   'e.g. Reduced CAC by 28% while scaling monthly spend from 5L to 12L.',
   'Share one or two measurable outcomes. Do not include confidential client information.',
   30, '{"maxLength": 1000}')
) AS v(field_key, field_label, field_type, is_required, placeholder, helper_text, sort_order, validation_rules)
ON CONFLICT (category_id, field_key) DO UPDATE SET
  field_label = EXCLUDED.field_label,
  field_type = EXCLUDED.field_type,
  is_required = EXCLUDED.is_required,
  placeholder = EXCLUDED.placeholder,
  helper_text = EXCLUDED.helper_text,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  validation_rules = EXCLUDED.validation_rules;

-- Portfolio / service categories.
WITH cat AS (SELECT id FROM categories WHERE slug = 'ads-specialist' LIMIT 1)
INSERT INTO template_categories (category_id, name, sort_order, is_active)
SELECT cat.id, v.name, v.sort_order, TRUE
FROM cat CROSS JOIN (VALUES
  ('Paid social', 10),
  ('Paid search', 20),
  ('Video advertising', 30),
  ('Marketplace advertising', 40),
  ('B2B demand generation', 50),
  ('App acquisition', 60),
  ('Retargeting', 70),
  ('Conversion optimisation', 80)
) AS v(name, sort_order)
ON CONFLICT (category_id, name) DO UPDATE SET is_active = TRUE, sort_order = EXCLUDED.sort_order;

-- Specialist skills.
WITH cat AS (SELECT id FROM categories WHERE slug = 'ads-specialist' LIMIT 1)
INSERT INTO template_skill_sets (category_id, name, "group", sort_order, is_active)
SELECT cat.id, v.name, v."group", v.sort_order, TRUE
FROM cat CROSS JOIN (VALUES
  ('Paid media strategy', 'Strategy', 10),
  ('Media planning', 'Strategy', 20),
  ('Audience research', 'Strategy', 30),
  ('Campaign setup', 'Campaign management', 40),
  ('Campaign optimisation', 'Campaign management', 50),
  ('Budget pacing', 'Campaign management', 60),
  ('Creative testing', 'Optimisation', 70),
  ('Landing-page CRO', 'Optimisation', 80),
  ('Conversion tracking', 'Measurement', 90),
  ('Attribution', 'Measurement', 100),
  ('Funnel analysis', 'Measurement', 110),
  ('Performance reporting', 'Measurement', 120)
) AS v(name, "group", sort_order)
ON CONFLICT (category_id, name) DO UPDATE SET
  "group" = EXCLUDED."group", sort_order = EXCLUDED.sort_order, is_active = TRUE;
-- Ad platforms, analytics, and reporting tools.
WITH cat AS (SELECT id FROM categories WHERE slug = 'ads-specialist' LIMIT 1)
INSERT INTO template_tools (category_id, name, "group", sort_order, is_active)
SELECT cat.id, v.name, v."group", v.sort_order, TRUE
FROM cat CROSS JOIN (VALUES
  ('Meta Ads Manager', 'Ad platforms', 10),
  ('Google Ads', 'Ad platforms', 20),
  ('LinkedIn Campaign Manager', 'Ad platforms', 30),
  ('YouTube Ads', 'Ad platforms', 40),
  ('Amazon Ads', 'Ad platforms', 50),
  ('ChatGPT Ads', 'Ad platforms', 60),
  ('GA4', 'Analytics & tracking', 70),
  ('Google Tag Manager', 'Analytics & tracking', 80),
  ('Looker Studio', 'Analytics & reporting', 90),
  ('HubSpot', 'CRM & automation', 100),
  ('Semrush', 'Research', 110)
) AS v(name, "group", sort_order)
ON CONFLICT (category_id, name) DO UPDATE SET
  "group" = EXCLUDED."group", sort_order = EXCLUDED.sort_order, is_active = TRUE;

-- AI-assisted research and creative tools.
WITH cat AS (SELECT id FROM categories WHERE slug = 'ads-specialist' LIMIT 1)
INSERT INTO template_ai_tools (category_id, name, "group", sort_order, is_active)
SELECT cat.id, v.name, 'AI tools', v.sort_order, TRUE
FROM cat CROSS JOIN (VALUES
  ('ChatGPT', 10),
  ('Claude', 20),
  ('AdCreative.ai', 30),
  ('Jasper', 40),
  ('Canva Magic Studio', 50)
) AS v(name, sort_order)
ON CONFLICT (category_id, name) DO UPDATE SET
  "group" = EXCLUDED."group", sort_order = EXCLUDED.sort_order, is_active = TRUE;
