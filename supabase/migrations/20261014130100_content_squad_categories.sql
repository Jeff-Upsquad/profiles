-- Content Squad profiles and application forms. Additive and repeatable.

BEGIN;

ALTER TABLE talent_users DROP CONSTRAINT IF EXISTS talent_users_signup_form_type_check;

ALTER TABLE talent_users ADD CONSTRAINT talent_users_signup_form_type_check CHECK (signup_form_type IS NULL OR signup_form_type IN ('creative', 'accountant', 'sales', 'creative_director', 'copy_content_writer', 'social_media_manager', 'videographer_photographer', 'ai_video_image_creator', 'ads_specialist'));

INSERT INTO categories(id,name,slug,description,is_active,sort_order) VALUES ('ca148001-5800-4800-8800-000000000001'::uuid,'Creative Director','creative-director','Creative strategy, brand direction, campaign concepts and production leadership.',TRUE,60) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,is_active=TRUE;

INSERT INTO public_forms(form_type,title,description,url_path,enabled) VALUES ('creative_director','Creative Director','Creative strategy, brand direction, campaign concepts and production leadership.','/apply/creative_director',TRUE) ON CONFLICT (form_type) DO NOTHING;

INSERT INTO category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active,validation_rules) SELECT id,'professional_title','Professional title','text'::field_type_enum,TRUE,'Use a clear title for the work you do.',10,TRUE,'{"minLength": 3, "maxLength": 120}'::jsonb FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,field_key) DO NOTHING;

INSERT INTO category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active,validation_rules) SELECT id,'professional_summary','Professional summary','textarea'::field_type_enum,TRUE,'Describe your strengths, industries and the outcomes you deliver.',20,TRUE,'{"minLength": 40, "maxLength": 1200}'::jsonb FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,field_key) DO NOTHING;

INSERT INTO category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active,validation_rules) SELECT id,'creative_leadership','Creative leadership and results','textarea'::field_type_enum,FALSE,'Describe your creative process, team leadership, campaign scope and measurable results.',30,TRUE,'{"maxLength": 1200}'::jsonb FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,field_key) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Brand strategy',10,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Campaign concepts',20,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Art direction',30,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Content strategy',40,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Video direction',50,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Creative production',60,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Brand guidelines',70,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Creative audits',80,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Creative strategy',10,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Concept development',20,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Art direction',30,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Storytelling',40,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Team leadership',50,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Production planning',60,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Client presentation',70,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Creative quality control',80,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Figma',10,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Adobe Creative Cloud',20,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Miro',30,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Notion',40,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Google Slides',50,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Frame.io',60,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'ChatGPT',10,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Claude',20,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Midjourney',30,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Adobe Firefly',40,TRUE FROM categories WHERE slug='creative-director' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO categories(id,name,slug,description,is_active,sort_order) VALUES ('ca148001-5800-4800-8800-000000000002'::uuid,'Copy / Content Writer','copy-content-writer','Brand copy, articles, scripts, email campaigns and search-focused content.',TRUE,70) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,is_active=TRUE;

INSERT INTO public_forms(form_type,title,description,url_path,enabled) VALUES ('copy_content_writer','Copy / Content Writer','Brand copy, articles, scripts, email campaigns and search-focused content.','/apply/copy_content_writer',TRUE) ON CONFLICT (form_type) DO NOTHING;

INSERT INTO category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active,validation_rules) SELECT id,'professional_title','Professional title','text'::field_type_enum,TRUE,'Use a clear title for the work you do.',10,TRUE,'{"minLength": 3, "maxLength": 120}'::jsonb FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,field_key) DO NOTHING;

INSERT INTO category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active,validation_rules) SELECT id,'professional_summary','Professional summary','textarea'::field_type_enum,TRUE,'Describe your strengths, industries and the outcomes you deliver.',20,TRUE,'{"minLength": 40, "maxLength": 1200}'::jsonb FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,field_key) DO NOTHING;

INSERT INTO category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active,validation_rules) SELECT id,'writing_approach','Writing approach and subject expertise','textarea'::field_type_enum,FALSE,'Describe your research, tone of voice, subject expertise and how you measure content performance.',30,TRUE,'{"maxLength": 1200}'::jsonb FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,field_key) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Website copy',10,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Blog articles',20,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'SEO content',30,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Ad copy',40,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Email campaigns',50,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Social captions',60,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Video scripts',70,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Brand messaging',80,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Copywriting',10,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Content research',20,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'SEO writing',30,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Editing and proofreading',40,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Brand voice',50,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Scriptwriting',60,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Conversion writing',70,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Fact checking',80,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Google Docs',10,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Microsoft Word',20,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Grammarly',30,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'WordPress',40,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Semrush',50,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Ahrefs',60,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Notion',70,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'ChatGPT',10,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Claude',20,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Jasper',30,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Perplexity',40,TRUE FROM categories WHERE slug='copy-content-writer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO categories(id,name,slug,description,is_active,sort_order) VALUES ('ca148001-5800-4800-8800-000000000003'::uuid,'Social Media Manager','social-media-manager','Social strategy, publishing, community management and organic audience growth.',TRUE,80) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,is_active=TRUE;

INSERT INTO public_forms(form_type,title,description,url_path,enabled) VALUES ('social_media_manager','Social Media Manager','Social strategy, publishing, community management and organic audience growth.','/apply/social_media_manager',TRUE) ON CONFLICT (form_type) DO NOTHING;

INSERT INTO category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active,validation_rules) SELECT id,'professional_title','Professional title','text'::field_type_enum,TRUE,'Use a clear title for the work you do.',10,TRUE,'{"minLength": 3, "maxLength": 120}'::jsonb FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,field_key) DO NOTHING;

INSERT INTO category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active,validation_rules) SELECT id,'professional_summary','Professional summary','textarea'::field_type_enum,TRUE,'Describe your strengths, industries and the outcomes you deliver.',20,TRUE,'{"minLength": 40, "maxLength": 1200}'::jsonb FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,field_key) DO NOTHING;

INSERT INTO category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active,validation_rules) SELECT id,'account_results','Accounts managed and growth results','textarea'::field_type_enum,FALSE,'Describe platforms, account sizes, engagement improvements, community work and reporting.',30,TRUE,'{"maxLength": 1200}'::jsonb FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,field_key) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Instagram',10,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Facebook',20,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'LinkedIn',30,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'YouTube',40,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'TikTok',50,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'X / Twitter',60,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Pinterest',70,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Community management',80,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Social strategy',10,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Content calendars',20,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Community management',30,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Social copywriting',40,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Social analytics',50,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Audience growth',60,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Influencer coordination',70,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Crisis response',80,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Meta Business Suite',10,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Buffer',20,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Hootsuite',30,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Later',40,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Sprout Social',50,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Canva',60,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Google Analytics',70,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'ChatGPT',10,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Claude',20,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Canva Magic Studio',30,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'CapCut AI',40,TRUE FROM categories WHERE slug='social-media-manager' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO categories(id,name,slug,description,is_active,sort_order) VALUES ('ca148001-5800-4800-8800-000000000004'::uuid,'Videographer / Photographer','videographer-photographer','Brand, product, event and location photography and video production.',TRUE,90) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,is_active=TRUE;

INSERT INTO public_forms(form_type,title,description,url_path,enabled) VALUES ('videographer_photographer','Videographer / Photographer','Brand, product, event and location photography and video production.','/apply/videographer_photographer',TRUE) ON CONFLICT (form_type) DO NOTHING;

INSERT INTO category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active,validation_rules) SELECT id,'professional_title','Professional title','text'::field_type_enum,TRUE,'Use a clear title for the work you do.',10,TRUE,'{"minLength": 3, "maxLength": 120}'::jsonb FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,field_key) DO NOTHING;

INSERT INTO category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active,validation_rules) SELECT id,'professional_summary','Professional summary','textarea'::field_type_enum,TRUE,'Describe your strengths, industries and the outcomes you deliver.',20,TRUE,'{"minLength": 40, "maxLength": 1200}'::jsonb FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,field_key) DO NOTHING;

INSERT INTO category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active,validation_rules) SELECT id,'equipment_and_travel','Equipment, production setup and travel','textarea'::field_type_enum,FALSE,'List camera, audio, lighting and crew capabilities, your shooting locations and travel availability.',30,TRUE,'{"maxLength": 1200}'::jsonb FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,field_key) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Product photography',10,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Brand films',20,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Events',30,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Portraits',40,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Food photography',50,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Real estate',60,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Interviews',70,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Social video shoots',80,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Camera operation',10,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Lighting',20,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Composition',30,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Audio recording',40,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Shot planning',50,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'On-set direction',60,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Photo retouching',70,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Production coordination',80,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Adobe Lightroom',10,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Adobe Photoshop',20,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'DaVinci Resolve',30,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Adobe Premiere Pro',40,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Capture One',50,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Frame.io',60,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Adobe Firefly',10,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Photoshop Generative Fill',20,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Topaz Photo AI',30,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Runway',40,TRUE FROM categories WHERE slug='videographer-photographer' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO categories(id,name,slug,description,is_active,sort_order) VALUES ('ca148001-5800-4800-8800-000000000005'::uuid,'AI Video / Image Creator','ai-video-image-creator','AI-assisted visual concepts, images and video with consistent creative finishing.',TRUE,100) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,is_active=TRUE;

INSERT INTO public_forms(form_type,title,description,url_path,enabled) VALUES ('ai_video_image_creator','AI Video / Image Creator','AI-assisted visual concepts, images and video with consistent creative finishing.','/apply/ai_video_image_creator',TRUE) ON CONFLICT (form_type) DO NOTHING;

INSERT INTO category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active,validation_rules) SELECT id,'professional_title','Professional title','text'::field_type_enum,TRUE,'Use a clear title for the work you do.',10,TRUE,'{"minLength": 3, "maxLength": 120}'::jsonb FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,field_key) DO NOTHING;

INSERT INTO category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active,validation_rules) SELECT id,'professional_summary','Professional summary','textarea'::field_type_enum,TRUE,'Describe your strengths, industries and the outcomes you deliver.',20,TRUE,'{"minLength": 40, "maxLength": 1200}'::jsonb FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,field_key) DO NOTHING;

INSERT INTO category_fields(category_id,field_key,field_label,field_type,is_required,helper_text,sort_order,is_active,validation_rules) SELECT id,'ai_workflow','AI workflow and creative finishing','textarea'::field_type_enum,FALSE,'Explain generation tools, prompting, character/style consistency, editing and your commercial-use checks.',30,TRUE,'{"maxLength": 1200}'::jsonb FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,field_key) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'AI product images',10,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'AI brand visuals',20,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'AI video ads',30,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'AI short films',40,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Storyboards',50,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Character design',60,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Image enhancement',70,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_categories(category_id,name,sort_order,is_active) SELECT id,'Visual concepts',80,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Prompt design',10,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Image generation',20,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Video generation',30,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Style consistency',40,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Character consistency',50,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Compositing',60,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Upscaling',70,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_skill_sets(category_id,name,sort_order,is_active) SELECT id,'Creative quality control',80,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Adobe Photoshop',10,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Adobe Premiere Pro',20,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'DaVinci Resolve',30,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'ComfyUI',40,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'Canva',50,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_tools(category_id,name,sort_order,is_active) SELECT id,'After Effects',60,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Midjourney',10,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Runway',20,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Kling',30,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Adobe Firefly',40,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Stable Diffusion',50,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Sora',60,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO template_ai_tools(category_id,name,sort_order,is_active) SELECT id,'Veo',70,TRUE FROM categories WHERE slug='ai-video-image-creator' ON CONFLICT (category_id,name) DO NOTHING;

INSERT INTO public_forms(form_type,title,description,url_path,enabled) VALUES ('ads_specialist','Ads Specialist','Paid media candidates','/apply/ads_specialist',TRUE) ON CONFLICT (form_type) DO NOTHING;

INSERT INTO interview_questions(form_type,question_text,field_type,is_required,display_order) SELECT 'creative_director',x.question,'textarea',TRUE,x.ord FROM (VALUES ('Tell us about one Creative Director project: your responsibilities, process and results.',0),('Describe your creative process, team leadership, campaign scope and measurable results.',1),('How do you handle a brief, feedback and delivery deadlines?',2)) x(question,ord) WHERE NOT EXISTS(SELECT 1 FROM interview_questions WHERE form_type='creative_director');

INSERT INTO interview_questions(form_type,question_text,field_type,is_required,display_order) SELECT 'copy_content_writer',x.question,'textarea',TRUE,x.ord FROM (VALUES ('Tell us about one Copy / Content Writer project: your responsibilities, process and results.',0),('Describe your research, tone of voice, subject expertise and how you measure content performance.',1),('How do you handle a brief, feedback and delivery deadlines?',2)) x(question,ord) WHERE NOT EXISTS(SELECT 1 FROM interview_questions WHERE form_type='copy_content_writer');

INSERT INTO interview_questions(form_type,question_text,field_type,is_required,display_order) SELECT 'social_media_manager',x.question,'textarea',TRUE,x.ord FROM (VALUES ('Tell us about one Social Media Manager project: your responsibilities, process and results.',0),('Describe platforms, account sizes, engagement improvements, community work and reporting.',1),('How do you handle a brief, feedback and delivery deadlines?',2)) x(question,ord) WHERE NOT EXISTS(SELECT 1 FROM interview_questions WHERE form_type='social_media_manager');

INSERT INTO interview_questions(form_type,question_text,field_type,is_required,display_order) SELECT 'videographer_photographer',x.question,'textarea',TRUE,x.ord FROM (VALUES ('Tell us about one Videographer / Photographer project: your responsibilities, process and results.',0),('List camera, audio, lighting and crew capabilities, your shooting locations and travel availability.',1),('How do you handle a brief, feedback and delivery deadlines?',2)) x(question,ord) WHERE NOT EXISTS(SELECT 1 FROM interview_questions WHERE form_type='videographer_photographer');

INSERT INTO interview_questions(form_type,question_text,field_type,is_required,display_order) SELECT 'ai_video_image_creator',x.question,'textarea',TRUE,x.ord FROM (VALUES ('Tell us about one AI Video / Image Creator project: your responsibilities, process and results.',0),('Explain generation tools, prompting, character/style consistency, editing and your commercial-use checks.',1),('How do you handle a brief, feedback and delivery deadlines?',2)) x(question,ord) WHERE NOT EXISTS(SELECT 1 FROM interview_questions WHERE form_type='ai_video_image_creator');
COMMIT;

NOTIFY pgrst, 'reload schema';
