-- Missed-webinar notice: when an admin marks a webinar completed, registrants
-- not ticked as attended get one "you missed it — register for the next one"
-- message. The stamp makes it exactly-once per registration, so moving the
-- webinar back to published and completing it again never re-sends.

ALTER TABLE training_webinar_registrations
  ADD COLUMN IF NOT EXISTS missed_notified_at TIMESTAMPTZ;
