-- Webinar "notify me" + configurable webinar languages.
--
-- Talent Training → Upcoming webinars shows an empty state with a Notify-me
-- button when there is nothing scheduled. The talent picks a language and a
-- row lands in training_webinar_interests; publishing a webinar in that
-- language notifies them (panel + push + WhatsApp `talent_webinar_new_scheduled`).
--
-- webinar_languages is the admin-managed allow-list: only active codes can be
-- picked when creating/editing a webinar and only active codes are offered in
-- the talent Notify-me picker. Seeded with the two languages we run today.

CREATE TABLE IF NOT EXISTS public.webinar_languages (
  code TEXT PRIMARY KEY CHECK (code ~ '^[a-z]{2,10}$'),
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.webinar_languages (code, label, is_active, sort_order)
VALUES ('en', 'English', true, 1), ('ml', 'Malayalam', true, 2)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.training_webinar_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (talent_user_id, language)
);

CREATE INDEX IF NOT EXISTS idx_webinar_interests_language
  ON public.training_webinar_interests (language);
CREATE INDEX IF NOT EXISTS idx_webinar_interests_talent
  ON public.training_webinar_interests (talent_user_id);

ALTER TABLE public.webinar_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_webinar_interests ENABLE ROW LEVEL SECURITY;

-- Backend (service role) only; browsers go through the admin/talent APIs.
REVOKE ALL ON TABLE public.webinar_languages FROM anon, authenticated;
REVOKE ALL ON TABLE public.training_webinar_interests FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.webinar_languages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.training_webinar_interests TO service_role;
