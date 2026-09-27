-- A withdrawal belongs to a program. The old global flag is only set when
-- every non-rejected program the applicant requested has been cancelled.
ALTER TABLE public.talent_users ADD COLUMN IF NOT EXISTS application_cancellations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.talent_users ADD COLUMN IF NOT EXISTS crm_hold_sync_pending boolean NOT NULL DEFAULT false;
ALTER TABLE public.squad_bot_conversations ADD COLUMN IF NOT EXISTS cancellation_pending_at timestamptz;

UPDATE public.talent_users SET application_cancellations =
  (CASE WHEN partner_approval_status IS NOT NULL THEN jsonb_build_object('partner', jsonb_build_object('reason', 'no_response', 'at', application_cancelled_at)) ELSE '{}'::jsonb END) ||
  (CASE WHEN wants_jobs THEN jsonb_build_object('jobs', jsonb_build_object('reason', 'no_response', 'at', application_cancelled_at)) ELSE '{}'::jsonb END)
WHERE application_cancelled_at IS NOT NULL AND application_cancellations = '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.sync_application_cancellation_summary() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.application_cancellations IS DISTINCT FROM OLD.application_cancellations THEN
    NEW.crm_hold_sync_pending := true;
    IF NEW.application_cancellations <> '{}'::jsonb
      AND (NEW.partner_approval_status IS NULL OR NEW.partner_approval_status = 'rejected' OR NEW.pipeline_stage = 'rejected' OR NEW.application_cancellations ? 'partner')
      AND (NOT COALESCE(NEW.wants_jobs, false) OR NEW.jobs_pipeline_stage = 'rejected' OR NEW.application_cancellations ? 'jobs') THEN
      NEW.application_cancelled_at := COALESCE(NEW.application_cancelled_at, now());
      NEW.application_cancelled_reason := CASE WHEN NEW.application_cancellations @> '{"partner":{"reason":"not_interested"}}'::jsonb
        OR NEW.application_cancellations @> '{"jobs":{"reason":"not_interested"}}'::jsonb
        THEN 'Applicant confirmed they are not interested' ELSE 'Requested changes were not made within the deadline' END;
    ELSE
      NEW.application_cancelled_at := NULL;
      NEW.application_cancelled_reason := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_application_cancellation_summary ON public.talent_users;
CREATE TRIGGER sync_application_cancellation_summary BEFORE UPDATE ON public.talent_users
FOR EACH ROW EXECUTE FUNCTION public.sync_application_cancellation_summary();

-- Row lock makes repeated or simultaneous confirmation/reminder events safe.
CREATE OR REPLACE FUNCTION public.cancel_applicant_tracks(p_talent_id uuid, p_tracks text[], p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.talent_users%ROWTYPE; selected text; cancellations jsonb;
BEGIN
  IF p_reason NOT IN ('no_response', 'not_interested') OR NOT p_tracks <@ ARRAY['partner','jobs']::text[] THEN
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
    -- An automatic timeout must not overwrite a confirmed withdrawal.
    IF p_reason = 'no_response' AND cancellations ? selected THEN CONTINUE; END IF;
    cancellations := cancellations || jsonb_build_object(selected, jsonb_build_object('reason', p_reason, 'at', now()));
  END LOOP;
  UPDATE public.talent_users SET application_cancellations = cancellations WHERE id = p_talent_id;
  RETURN cancellations;
END $$;
REVOKE ALL ON FUNCTION public.cancel_applicant_tracks(uuid, text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_applicant_tracks(uuid, text[], text) TO service_role;
