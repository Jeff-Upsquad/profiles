-- Separate agency training audience, progress, and webinar enrolment.
-- Existing courses and webinars remain talent-only.
ALTER TABLE public.training_items
  ADD COLUMN IF NOT EXISTS talent_audience BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS agency_audience BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.training_webinars
  ADD COLUMN IF NOT EXISTS recipient_type TEXT NOT NULL DEFAULT 'talent'
  CHECK (recipient_type IN ('talent', 'agency'));

CREATE TABLE IF NOT EXISTS public.agency_training_page_progress (
  agency_user_id UUID NOT NULL REFERENCES public.agency_users(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES public.training_pages(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_user_id, page_id)
);

CREATE TABLE IF NOT EXISTS public.agency_training_course_starts (
  agency_user_id UUID NOT NULL REFERENCES public.agency_users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.training_items(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_user_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.agency_training_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_user_id UUID NOT NULL REFERENCES public.agency_users(id) ON DELETE CASCADE,
  block_id UUID NOT NULL REFERENCES public.training_blocks(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  score_percent INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agency_training_quiz_attempts_user
  ON public.agency_training_quiz_attempts (agency_user_id, block_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.agency_webinar_registrations (
  webinar_id UUID NOT NULL REFERENCES public.training_webinars(id) ON DELETE CASCADE,
  agency_user_id UUID NOT NULL REFERENCES public.agency_users(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attended_at TIMESTAMPTZ,
  day_notified_at TIMESTAMPTZ,
  min30_notified_at TIMESTAMPTZ,
  min5_notified_at TIMESTAMPTZ,
  missed_notified_at TIMESTAMPTZ,
  PRIMARY KEY (webinar_id, agency_user_id)
);
CREATE INDEX IF NOT EXISTS idx_agency_webinar_registrations_user
  ON public.agency_webinar_registrations (agency_user_id);

CREATE TABLE IF NOT EXISTS public.agency_webinar_interests (
  agency_user_id UUID NOT NULL REFERENCES public.agency_users(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_user_id, language)
);
CREATE INDEX IF NOT EXISTS idx_agency_webinar_interests_language
  ON public.agency_webinar_interests (language);

CREATE TABLE IF NOT EXISTS public.agency_training_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_user_id UUID NOT NULL REFERENCES public.agency_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_agency_training_notifications_user
  ON public.agency_training_notifications (agency_user_id, created_at DESC);

ALTER TABLE public.agency_training_page_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_training_course_starts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_training_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_webinar_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_webinar_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_training_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.agency_training_page_progress, public.agency_training_course_starts,
  public.agency_training_quiz_attempts,
  public.agency_webinar_registrations, public.agency_webinar_interests,
  public.agency_training_notifications FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agency_training_page_progress,
  public.agency_training_course_starts, public.agency_training_quiz_attempts, public.agency_webinar_registrations,
  public.agency_webinar_interests, public.agency_training_notifications TO service_role;

NOTIFY pgrst, 'reload schema';
