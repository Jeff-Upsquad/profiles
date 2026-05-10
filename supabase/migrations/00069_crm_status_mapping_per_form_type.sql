-- 00069_crm_status_mapping_per_form_type.sql
-- Reshape admin_settings.crm_status_mapping from a single-pipeline config
-- (pipeline_name + form_types[] + mappings) to a per-form-type structure
-- (pipelines keyed by form_type, each with pipeline_name + mappings). The
-- top-level crm_webhook_url is kept since all form_types still use the
-- same shcrm endpoint.
--
-- Idempotent: only rewrites rows that don't already have the `pipelines`
-- key (i.e. haven't been migrated). The first form_type from the legacy
-- form_types array becomes the pipelines key; if absent, defaults to
-- 'creative' (the only deployed form_type today).

UPDATE admin_settings
SET value = jsonb_build_object(
  'crm_webhook_url', value->>'crm_webhook_url',
  'pipelines', jsonb_build_object(
    COALESCE(value->'form_types'->>0, 'creative'),
    jsonb_build_object(
      'pipeline_name', value->>'pipeline_name',
      'mappings', value->'mappings'
    )
  )
)
WHERE key = 'crm_status_mapping' AND NOT (value ? 'pipelines');
