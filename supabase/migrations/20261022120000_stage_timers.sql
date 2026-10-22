-- Onboarding stage timers.
--
-- Each onboarding module (Partner Program / Jobs) can give every candidate
-- stage a time limit (admin_settings.stage_timers). When the applicant misses
-- it, that track goes inactive; after the stage's grace period it is cancelled
-- through cancel_applicant_tracks (reason no_response).
--
--   track_inactivity  {partner|jobs: {at, stage, by: 'system'|'admin'}}
--   stage_timer_state {reset: {partner|jobs: iso}, notice: {partner|jobs: {stage, at}}, rc_paused: bool}
--     reset     — clock restart (reactivation, end of a request-changes pause)
--     notice    — the stage entry whose "complete this within N" message went out
--     rc_paused — the talent was under request changes on the last sweep
ALTER TABLE public.talent_users
  ADD COLUMN IF NOT EXISTS track_inactivity jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS stage_timer_state jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS talent_users_track_inactivity_idx
  ON public.talent_users ((track_inactivity <> '{}'::jsonb))
  WHERE track_inactivity <> '{}'::jsonb;

-- A cancelled track is no longer inactive — it lives in Cancelled Applicants.
CREATE OR REPLACE FUNCTION public.clear_inactivity_on_cancel() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.application_cancellations IS DISTINCT FROM OLD.application_cancellations THEN
    IF NEW.application_cancellations ? 'partner' THEN NEW.track_inactivity := NEW.track_inactivity - 'partner'; END IF;
    IF NEW.application_cancellations ? 'jobs' THEN NEW.track_inactivity := NEW.track_inactivity - 'jobs'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS clear_inactivity_on_cancel ON public.talent_users;
CREATE TRIGGER clear_inactivity_on_cancel BEFORE UPDATE ON public.talent_users
FOR EACH ROW EXECUTE FUNCTION public.clear_inactivity_on_cancel();

-- Third cancellation reason: an inactive track that was never reactivated.
CREATE OR REPLACE FUNCTION public.cancel_applicant_tracks(p_talent_id uuid, p_tracks text[], p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.talent_users%ROWTYPE; selected text; cancellations jsonb;
BEGIN
  IF p_reason NOT IN ('no_response', 'not_interested', 'inactive') OR NOT p_tracks <@ ARRAY['partner','jobs']::text[] THEN
    RAISE EXCEPTION 'Invalid cancellation';
  END IF;
  SELECT * INTO t FROM public.talent_users WHERE id = p_talent_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talent not found'; END IF;
  IF t.suspended OR t.blacklisted THEN RAISE EXCEPTION 'The team must handle this account status'; END IF;
  cancellations := t.application_cancellations;
  FOREACH selected IN ARRAY p_tracks LOOP
    IF selected = 'partner' AND (t.partner_approval_status IS NULL OR t.partner_approval_status = 'rejected' OR t.pipeline_stage = 'rejected') THEN CONTINUE; END IF;
    IF selected = 'jobs' AND (NOT COALESCE(t.wants_jobs, false) OR t.jobs_pipeline_stage = 'rejected') THEN CONTINUE; END IF;
    IF lower(trim(COALESCE(CASE WHEN selected = 'jobs' THEN t.crm_jobs_stage_name ELSE t.crm_talent_stage_name END, ''))) = 'onboarding completed' THEN
      RAISE EXCEPTION 'Completed onboarding: the team must handle this request';
    END IF;
    -- An automatic timeout must not overwrite an existing cancellation.
    IF p_reason <> 'not_interested' AND cancellations ? selected THEN CONTINUE; END IF;
    cancellations := cancellations || jsonb_build_object(selected, jsonb_build_object('reason', p_reason, 'at', now()));
  END LOOP;
  UPDATE public.talent_users SET application_cancellations = cancellations WHERE id = p_talent_id;
  RETURN cancellations;
END $$;
REVOKE ALL ON FUNCTION public.cancel_applicant_tracks(uuid, text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_applicant_tracks(uuid, text[], text) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_application_cancellation_summary() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.application_cancellations IS DISTINCT FROM OLD.application_cancellations THEN
    NEW.crm_hold_sync_pending := true;
    IF NEW.application_cancellations <> '{}'::jsonb
      AND (NEW.partner_approval_status IS NULL OR NEW.partner_approval_status = 'rejected' OR NEW.pipeline_stage = 'rejected' OR NEW.application_cancellations ? 'partner')
      AND (NOT COALESCE(NEW.wants_jobs, false) OR NEW.jobs_pipeline_stage = 'rejected' OR NEW.application_cancellations ? 'jobs') THEN
      NEW.application_cancelled_at := COALESCE(NEW.application_cancelled_at, now());
      NEW.application_cancelled_reason := CASE
        WHEN NEW.application_cancellations @> '{"partner":{"reason":"not_interested"}}'::jsonb
          OR NEW.application_cancellations @> '{"jobs":{"reason":"not_interested"}}'::jsonb
          THEN 'Applicant confirmed they are not interested'
        WHEN NEW.application_cancellations @> '{"partner":{"reason":"inactive"}}'::jsonb
          OR NEW.application_cancellations @> '{"jobs":{"reason":"inactive"}}'::jsonb
          THEN 'Onboarding step not completed in time and the profile was not reactivated'
        ELSE 'Requested changes were not made within the deadline' END;
    ELSE
      NEW.application_cancelled_at := NULL;
      NEW.application_cancelled_reason := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
