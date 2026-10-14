-- Apply after SquadHire CRM's Content Squad pipeline migration.
BEGIN;
DO $$
DECLARE cfg jsonb; r record; jobs boolean; board_name text; map_key text; pid uuid; ws uuid; stage_map jsonb; snapshot jsonb; talent_snapshot jsonb;
BEGIN
  SELECT value INTO cfg FROM admin_settings WHERE key='crm_status_mapping' FOR UPDATE;
  IF cfg IS NULL THEN RAISE EXCEPTION 'Configure the existing CRM integration before seeding Content Squad mappings'; END IF;
  SELECT workspace_id INTO ws FROM crm_pipelines WHERE kind='candidates' AND name=cfg->'pipelines'->'creative'->>'pipeline_name' AND NOT is_archived;
  IF ws IS NULL THEN RAISE EXCEPTION 'The linked Designer / Editor CRM workspace was not found'; END IF;
  FOR r IN SELECT * FROM (VALUES
      ('creative_director','Creative Directors'),
      ('copy_content_writer','Copy and Content Writers'),
      ('social_media_manager','Social Media Managers'),
      ('videographer_photographer','Videographers and Photographers'),
      ('ai_video_image_creator','AI Video and Image Creators'),
      ('ads_specialist','Ads Specialists')
  ) AS role(form_type,pipeline_name) LOOP
    FOREACH jobs IN ARRAY ARRAY[false,true] LOOP
      map_key := CASE WHEN jobs THEN 'jobs_' || r.form_type ELSE r.form_type END;
      board_name := CASE WHEN jobs THEN 'Jobs – ' || r.pipeline_name ELSE r.pipeline_name END;
      SELECT id INTO pid FROM crm_pipelines WHERE workspace_id=ws AND kind='candidates' AND name=board_name AND NOT is_archived;
      IF pid IS NULL THEN RAISE EXCEPTION 'Missing Content Squad CRM board: %',board_name; END IF;
      SELECT jsonb_object_agg(x.key,s.id::text) INTO stage_map FROM (VALUES ('new','New Applicants'),('share_form','Share Landing Page'),('form_filled','Signed Up / Applicants'),('shortlisted','Shortlisted'),('signed_up','Application Approved'),('onboarding_training','Onboarding Training'),('basic_profile','Basic Profile'),('job_profile','Job Profile'),('portfolio_updation','Portfolio Updation'),('final_review','Final Review'),('live','Live'),('no_response','No Response / In Active'),('rejected','Rejected / Disqualified')) x(key,label)
        JOIN crm_stages s ON s.pipeline_id=pid AND lower(btrim(s.name))=lower(x.label);
      SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'sort_order',sort_order) ORDER BY sort_order),'[]') INTO snapshot FROM crm_stages WHERE pipeline_id=pid;
      IF NOT (coalesce(cfg->'pipelines','{}'::jsonb) ? map_key) THEN
        cfg := jsonb_set(cfg,'{pipelines}',coalesce(cfg->'pipelines','{}'::jsonb) || jsonb_build_object(map_key,jsonb_build_object('pipeline_name',board_name,'mappings',stage_map,'stages',snapshot)));
      END IF;
      SELECT id INTO pid FROM crm_pipelines WHERE workspace_id=ws AND kind='talent' AND name=board_name AND NOT is_archived;
      SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'sort_order',sort_order) ORDER BY sort_order),'[]') INTO talent_snapshot FROM crm_stages WHERE pipeline_id=pid;
      IF NOT (coalesce(cfg->'talent_pipelines','{}'::jsonb) ? map_key) THEN
        cfg := jsonb_set(cfg,'{talent_pipelines}',coalesce(cfg->'talent_pipelines','{}'::jsonb) || jsonb_build_object(map_key,jsonb_build_object('pipeline_name',board_name,'stages',talent_snapshot)));
      END IF;
    END LOOP;
  END LOOP;
  UPDATE admin_settings SET value=cfg WHERE key='crm_status_mapping';
END $$;
-- Preserve custom reception settings while adding the new destination roles.
DO $$ DECLARE cfg jsonb; r jsonb; additions jsonb := '[]'::jsonb; BEGIN
  SELECT value INTO cfg FROM admin_settings WHERE key='squad_bot_sorting' FOR UPDATE;
  IF cfg IS NOT NULL THEN
    FOR r IN SELECT value FROM jsonb_array_elements('[{"key": "creative_director", "label": "Creative Director", "pipeline": "Creative Directors", "stage": "Share Landing Page", "description": "Creative strategy, brand direction, campaign concepts and production leadership."}, {"key": "copy_content_writer", "label": "Copy / Content Writer", "pipeline": "Copy and Content Writers", "stage": "Share Landing Page", "description": "Brand copy, articles, scripts, email campaigns and search-focused content."}, {"key": "social_media_manager", "label": "Social Media Manager", "pipeline": "Social Media Managers", "stage": "Share Landing Page", "description": "Social strategy, publishing, community management and organic audience growth."}, {"key": "videographer_photographer", "label": "Videographer / Photographer", "pipeline": "Videographers and Photographers", "stage": "Share Landing Page", "description": "Brand, product, event and location photography and video production."}, {"key": "ai_video_image_creator", "label": "AI Video / Image Creator", "pipeline": "AI Video and Image Creators", "stage": "Share Landing Page", "description": "AI-assisted visual concepts, images and video with consistent creative finishing."}, {"key": "ads_specialist", "label": "Ads Specialist", "pipeline": "Ads Specialists", "stage": "Share Landing Page", "description": "Paid advertising and performance marketing talent."}]'::jsonb) LOOP
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(cfg->'roles','[]'::jsonb)) existing WHERE existing->>'key'=r->>'key') THEN additions:=additions||jsonb_build_array(r); END IF;
    END LOOP;
    UPDATE admin_settings SET value=jsonb_set(cfg,'{roles}',coalesce(cfg->'roles','[]'::jsonb)||additions) WHERE key='squad_bot_sorting';
  END IF;
END $$;
COMMIT;
