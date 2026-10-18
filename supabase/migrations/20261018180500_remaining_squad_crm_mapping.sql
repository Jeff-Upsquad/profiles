-- Apply after SquadHire CRM's remaining squad pipeline migration.
BEGIN;
DO $$
DECLARE cfg jsonb; r record; jobs boolean; board_name text; map_key text; pid uuid; ws uuid; stage_map jsonb; snapshot jsonb; talent_snapshot jsonb;
BEGIN
  SELECT value INTO cfg FROM admin_settings WHERE key='crm_status_mapping' FOR UPDATE;
  IF cfg IS NULL THEN RAISE EXCEPTION 'Configure the existing CRM integration before seeding remaining squad mappings'; END IF;
  SELECT workspace_id INTO ws FROM crm_pipelines WHERE kind='candidates' AND name=cfg->'pipelines'->'creative'->>'pipeline_name' AND NOT is_archived;
  IF ws IS NULL THEN RAISE EXCEPTION 'The linked Designer / Editor CRM workspace was not found'; END IF;
  FOR r IN SELECT * FROM (VALUES
('seo_specialist','SEO Specialists'),
('digital_marketing_team','Digital Marketing Teams'),
('influencer_marketing','Influencer Marketing Experts'),
('offline_marketing','Offline Marketing Specialists'),
('web_development','Web Developers'),
('app_building','App Developers'),
('automation','Automation Specialists'),
('software_solutions','Software Developers'),
('cfo_ca','CFOs and Chartered Accountants'),
('gst_experts','GST Experts'),
('tds_experts','TDS Experts'),
('labour_law','Labour Law Experts'),
('incorporation','Incorporation and Licensing Specialists'),
('contract_drafting','Contract Drafting Specialists'),
('ip_protection','IP Protection Specialists'),
('compliance','Compliance Specialists'),
('business_formation','Business Formation Specialists'),
('end_to_end_hiring','Recruitment Specialists'),
('team_building','Team Building Specialists'),
('hr_process','HR Process Specialists')
) AS role(form_type,pipeline_name) LOOP
    FOREACH jobs IN ARRAY ARRAY[false,true] LOOP
      map_key := CASE WHEN jobs THEN 'jobs_' || r.form_type ELSE r.form_type END;
      board_name := CASE WHEN jobs THEN 'Jobs – ' || r.pipeline_name ELSE r.pipeline_name END;
      SELECT id INTO pid FROM crm_pipelines WHERE workspace_id=ws AND kind='candidates' AND name=board_name AND NOT is_archived;
      IF pid IS NULL THEN RAISE EXCEPTION 'Missing remaining squad CRM board: %',board_name; END IF;
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
    FOR r IN SELECT value FROM jsonb_array_elements('[{"key": "seo_specialist", "label": "SEO Specialist", "pipeline": "SEO Specialists", "stage": "Share Landing Page", "description": "Explain your SEO audit process, search markets and organic growth results."}, {"key": "digital_marketing_team", "label": "Digital Marketing Team", "pipeline": "Digital Marketing Teams", "stage": "Share Landing Page", "description": "Describe channel expertise, team responsibilities and campaign outcomes."}, {"key": "influencer_marketing", "label": "Influencer Marketing Expert", "pipeline": "Influencer Marketing Experts", "stage": "Share Landing Page", "description": "Describe creator selection, campaign coordination and measurable results."}, {"key": "offline_marketing", "label": "Offline Marketing Specialist", "pipeline": "Offline Marketing Specialists", "stage": "Share Landing Page", "description": "Describe on-ground campaigns, locations served and execution capacity."}, {"key": "web_development", "label": "Web Developer", "pipeline": "Web Developers", "stage": "Share Landing Page", "description": "Describe your stack, delivery process, testing and deployed projects."}, {"key": "app_building", "label": "App Developer", "pipeline": "App Developers", "stage": "Share Landing Page", "description": "Describe platforms, architecture, app releases and maintenance experience."}, {"key": "automation", "label": "Automation Specialist", "pipeline": "Automation Specialists", "stage": "Share Landing Page", "description": "Describe workflows automated, systems connected and reliability controls."}, {"key": "software_solutions", "label": "Software Developer", "pipeline": "Software Developers", "stage": "Share Landing Page", "description": "Describe software architecture, integrations and production support experience."}, {"key": "cfo_ca", "label": "CFO / Chartered Accountant", "pipeline": "CFOs and Chartered Accountants", "stage": "Share Landing Page", "description": "Describe qualifications, professional registrations where applicable, finance responsibilities and outcomes."}, {"key": "gst_experts", "label": "GST Expert", "pipeline": "GST Experts", "stage": "Share Landing Page", "description": "Describe qualifications, GST work experience, reconciliations and filing process."}, {"key": "tds_experts", "label": "TDS Expert", "pipeline": "TDS Experts", "stage": "Share Landing Page", "description": "Describe TDS work, reconciliation process and qualifications."}, {"key": "labour_law", "label": "Labour Law Expert", "pipeline": "Labour Law Experts", "stage": "Share Landing Page", "description": "Describe qualifications, jurisdictions served and employment compliance experience."}, {"key": "incorporation", "label": "Incorporation & Licensing Specialist", "pipeline": "Incorporation and Licensing Specialists", "stage": "Share Landing Page", "description": "Describe qualifications, entity types, jurisdictions and registration experience."}, {"key": "contract_drafting", "label": "Contract Drafting Specialist", "pipeline": "Contract Drafting Specialists", "stage": "Share Landing Page", "description": "Describe legal qualifications, registrations, jurisdictions and contract experience."}, {"key": "ip_protection", "label": "IP Protection Specialist", "pipeline": "IP Protection Specialists", "stage": "Share Landing Page", "description": "Describe legal qualifications, jurisdictions, IP types and experience."}, {"key": "compliance", "label": "Compliance Specialist", "pipeline": "Compliance Specialists", "stage": "Share Landing Page", "description": "Describe qualifications, industries, jurisdictions and compliance review experience."}, {"key": "business_formation", "label": "Business Formation Specialist", "pipeline": "Business Formation Specialists", "stage": "Share Landing Page", "description": "Describe qualifications, entity structures and jurisdictions supported."}, {"key": "end_to_end_hiring", "label": "Recruitment Specialist", "pipeline": "Recruitment Specialists", "stage": "Share Landing Page", "description": "Describe roles hired, sourcing methods, hiring volume and placement results."}, {"key": "team_building", "label": "Team Building Specialist", "pipeline": "Team Building Specialists", "stage": "Share Landing Page", "description": "Describe teams supported, facilitation approach and organizational outcomes."}, {"key": "hr_process", "label": "HR Process Specialist", "pipeline": "HR Process Specialists", "stage": "Share Landing Page", "description": "Describe HR operations, workforce sizes, systems and process improvements."}]'::jsonb) LOOP
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(cfg->'roles','[]'::jsonb)) existing WHERE existing->>'key'=r->>'key') THEN additions:=additions||jsonb_build_array(r); END IF;
    END LOOP;
    UPDATE admin_settings SET value=jsonb_set(cfg,'{roles}',coalesce(cfg->'roles','[]'::jsonb)||additions) WHERE key='squad_bot_sorting';
  END IF;
END $$;
COMMIT;
