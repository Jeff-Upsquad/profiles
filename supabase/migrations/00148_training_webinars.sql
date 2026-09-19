-- Training webinars: created in SquadHire admin, listed inside talent Training.
-- Thailand talents one-click register; reminders go out day-of, T-30m and T-5m
-- via the notification panel + push + WhatsApp (CRM system event).

CREATE TABLE IF NOT EXISTS training_webinars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  meeting_link TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT 'thailand',
  status TEXT NOT NULL DEFAULT 'published',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_webinars_starts
  ON training_webinars (starts_at)
  WHERE status = 'published';

CREATE TABLE IF NOT EXISTS training_webinar_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id UUID NOT NULL REFERENCES training_webinars(id) ON DELETE CASCADE,
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  day_notified_at TIMESTAMPTZ,
  min30_notified_at TIMESTAMPTZ,
  min5_notified_at TIMESTAMPTZ,
  UNIQUE (webinar_id, talent_user_id)
);

CREATE INDEX IF NOT EXISTS idx_webinar_reg_webinar
  ON training_webinar_registrations (webinar_id);
CREATE INDEX IF NOT EXISTS idx_webinar_reg_talent
  ON training_webinar_registrations (talent_user_id);

ALTER TABLE training_webinars ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_webinar_registrations ENABLE ROW LEVEL SECURITY;
