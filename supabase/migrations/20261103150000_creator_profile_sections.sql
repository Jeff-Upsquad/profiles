-- Social Media Creator profile: structured Basic Information / Social Media
-- Platforms / Services & Rates form.
--  * Account type becomes three choices: Individual creator, Channel, Collective.
--  * Basic Information gains Gender and Age alongside Creator name.
--  * The old long-form steps (bio, free-text channel links, audience metrics,
--    demographics, sample links, collaboration types, free-text rates,
--    availability, usage rights) are replaced by the structured platforms and
--    services arrays the form stores in field_data JSON, so their field rows
--    are deactivated. Existing field_data is untouched.

-- 1) Account type: split "Channel / collective" into Channel + Collective.
UPDATE public.field_options o
SET label = 'Channel', value = 'Channel', sort_order = 1
FROM public.category_fields f JOIN public.categories c ON c.id = f.category_id
WHERE c.slug = 'social-media-creator' AND f.field_key = 'creator_type'
  AND o.field_id = f.id AND o.value = 'Channel / collective';

INSERT INTO public.field_options(field_id,label,value,sort_order,is_active)
SELECT f.id,'Collective','Collective',2,TRUE
FROM public.category_fields f JOIN public.categories c ON c.id = f.category_id
WHERE c.slug = 'social-media-creator' AND f.field_key = 'creator_type'
ON CONFLICT(field_id,value) DO NOTHING;

-- 2) Basic Information: creator name relabel, gender and age.
UPDATE public.category_fields f
SET field_label = 'Creator name'
FROM public.categories c
WHERE c.id = f.category_id AND c.slug = 'social-media-creator' AND f.field_key = 'creator_name';

INSERT INTO public.category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active)
SELECT id,'creator_gender','Gender','select'::field_type_enum,TRUE,'Used only for search filters.',15,TRUE
FROM public.categories WHERE slug='social-media-creator'
ON CONFLICT(category_id,field_key) DO UPDATE SET field_label=EXCLUDED.field_label,is_required=TRUE,is_active=TRUE,sort_order=EXCLUDED.sort_order;

INSERT INTO public.field_options(field_id,label,value,sort_order,is_active)
SELECT f.id,x.label,x.value,x.sort_order,TRUE
FROM public.category_fields f
JOIN public.categories c ON c.id = f.category_id
CROSS JOIN (VALUES ('Male','male',0),('Female','female',1),('Other','other',2),('Prefer not to say','prefer_not_to_say',3)) AS x(label,value,sort_order)
WHERE c.slug='social-media-creator' AND f.field_key='creator_gender'
ON CONFLICT(field_id,value) DO NOTHING;

INSERT INTO public.category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,validation_rules,sort_order,is_active)
SELECT id,'creator_age','Age','number'::field_type_enum,TRUE,'Age in years.','{"min":13,"max":100}',16,TRUE
FROM public.categories WHERE slug='social-media-creator'
ON CONFLICT(category_id,field_key) DO UPDATE SET field_label=EXCLUDED.field_label,is_required=TRUE,is_active=TRUE,sort_order=EXCLUDED.sort_order;

-- 3) Old long-form steps are replaced by the structured form (creator_platforms,
--    creator_services in field_data); deactivate their field rows.
UPDATE public.category_fields f
SET is_active = FALSE
FROM public.categories c
WHERE c.id = f.category_id AND c.slug = 'social-media-creator'
  AND f.field_key IN ('creator_bio','platforms','channel_links','content_niches','content_formats','audience_metrics','audience_demographics','sample_content','collaboration_types','rates','creator_availability','creator_rights');
