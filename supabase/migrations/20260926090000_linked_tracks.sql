-- Jobs + Partner Program applied together at signup are one application:
-- both pipelines move together and the talent gets one message per stage.
-- A track added later (tracks_linked = false) runs its own pipeline and
-- catches up on already-finished steps one stage at a time.

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS tracks_linked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_stage_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS jobs_stage_changed_at TIMESTAMPTZ;

COMMENT ON COLUMN talent_users.tracks_linked IS
  'Jobs and Partner Program were chosen together at signup — their pipelines move in lockstep.';

-- Both tracks requested at account creation (the signup application sets
-- partner_requested_at in the same insert).
UPDATE talent_users
SET tracks_linked = true
WHERE wants_jobs
  AND partner_approval_status IS NOT NULL
  AND partner_requested_at IS NOT NULL
  AND abs(extract(epoch FROM (partner_requested_at - created_at))) < 600;

-- Stamp every stage move so a catching-up track can pace itself.
CREATE OR REPLACE FUNCTION stamp_track_stage_changed() RETURNS trigger AS $fn$
BEGIN
  IF NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage THEN
    NEW.partner_stage_changed_at := now();
  END IF;
  IF NEW.jobs_pipeline_stage IS DISTINCT FROM OLD.jobs_pipeline_stage THEN
    NEW.jobs_stage_changed_at := now();
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stamp_track_stage_changed ON talent_users;
CREATE TRIGGER trg_stamp_track_stage_changed
  BEFORE UPDATE OF pipeline_stage, jobs_pipeline_stage ON talent_users
  FOR EACH ROW EXECUTE FUNCTION stamp_track_stage_changed();
