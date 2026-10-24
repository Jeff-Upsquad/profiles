-- A talent becomes active (shown in search, matched to subscriptions) the
-- moment either track reaches Live. Lead-status sync already did this for the
-- Partner Program card, but Jobs — and Partner moves mirrored from Jobs —
-- write the stage directly and left talents Live but inactive.
-- An admin's "mark inactive" (it records a reason) is never overridden.

CREATE OR REPLACE FUNCTION activate_talent_on_live() RETURNS trigger AS $fn$
BEGIN
  IF NEW.is_active = false AND NEW.inactive_reason IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF (NEW.pipeline_stage = 'live' AND OLD.pipeline_stage IS DISTINCT FROM 'live')
     OR (NEW.jobs_pipeline_stage = 'live' AND OLD.jobs_pipeline_stage IS DISTINCT FROM 'live') THEN
    NEW.is_active := true;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activate_talent_on_live ON talent_users;
CREATE TRIGGER trg_activate_talent_on_live
  BEFORE UPDATE OF pipeline_stage, jobs_pipeline_stage ON talent_users
  FOR EACH ROW EXECUTE FUNCTION activate_talent_on_live();
