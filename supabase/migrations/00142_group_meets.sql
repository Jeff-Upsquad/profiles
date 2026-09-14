-- Card-level Group Meet rooms. Invitees are a frozen snapshot of the
-- shortlisted + actively bidding audience at schedule time.

CREATE TABLE group_meets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES subscription_cards(id) ON DELETE CASCADE,
  business_user_id UUID NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  provider TEXT NOT NULL DEFAULT 'meet' CHECK (provider IN ('meet','zoom','teams','other')),
  meeting_link TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','rescheduled','cancelled','completed')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('business','salesperson','staff','admin')),
  created_by_id UUID,
  created_by_name TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE UNIQUE INDEX group_meets_one_live_per_card ON group_meets (card_id)
  WHERE status IN ('scheduled','rescheduled');
CREATE INDEX group_meets_business_idx ON group_meets (business_user_id, starts_at DESC);
CREATE TRIGGER trg_group_meets_updated_at BEFORE UPDATE ON group_meets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE group_meet_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_meet_id UUID NOT NULL REFERENCES group_meets(id) ON DELETE CASCADE,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('business','salesperson','staff','admin','talent')),
  participant_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  photo_url TEXT,
  recipient_id UUID REFERENCES subscription_card_recipients(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'guest' CHECK (role IN ('host','team','guest')),
  rsvp TEXT NOT NULL DEFAULT 'invited' CHECK (rsvp IN ('invited','accepted','declined')),
  rsvp_at TIMESTAMPTZ,
  agreed_amount JSONB,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_meet_id, participant_type, participant_id)
);

CREATE INDEX group_meet_members_participant_idx ON group_meet_members (participant_type, participant_id, created_at DESC);

CREATE TABLE group_meet_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_meet_id UUID NOT NULL REFERENCES group_meets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('business','salesperson','staff','admin','talent','system')),
  sender_id UUID,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX group_meet_messages_thread_idx ON group_meet_messages (group_meet_id, created_at);
ALTER TABLE group_meets ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_meet_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_meet_messages ENABLE ROW LEVEL SECURITY;
