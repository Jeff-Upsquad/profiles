-- Intro rooms: 3-party chat (business + talent + UpSquad salesperson)
-- plus simple meeting proposals. Hiring/intro only — not SquadHub work chat.
-- All access goes through Express + service-role; RLS is defense-in-depth.

-- ---------------------------------------------------------------------------
-- Default salesperson on a business (copied onto new rooms)
-- ---------------------------------------------------------------------------
ALTER TABLE business_users
  ADD COLUMN IF NOT EXISTS default_salesperson_id UUID REFERENCES staff_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS business_users_default_salesperson_idx
  ON business_users (default_salesperson_id)
  WHERE default_salesperson_id IS NOT NULL;

INSERT INTO admin_settings (key, value)
VALUES ('fallback_salesperson_id', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------
CREATE TABLE intro_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_user_id UUID NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES subscription_cards(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES subscription_card_recipients(id) ON DELETE SET NULL,
  job_candidate_id UUID REFERENCES job_candidates(id) ON DELETE SET NULL,
  salesperson_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'awaiting_salesperson', 'closed')),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_user_id, talent_user_id, card_id)
);

CREATE INDEX intro_conversations_business_idx
  ON intro_conversations (business_user_id, last_message_at DESC NULLS LAST);
CREATE INDEX intro_conversations_talent_idx
  ON intro_conversations (talent_user_id, last_message_at DESC NULLS LAST);
CREATE INDEX intro_conversations_salesperson_idx
  ON intro_conversations (salesperson_id, last_message_at DESC NULLS LAST)
  WHERE salesperson_id IS NOT NULL;
CREATE INDEX intro_conversations_card_idx
  ON intro_conversations (card_id);
CREATE INDEX intro_conversations_status_idx
  ON intro_conversations (status, last_message_at DESC NULLS LAST);

CREATE TRIGGER trg_intro_conversations_updated_at
  BEFORE UPDATE ON intro_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Members
-- ---------------------------------------------------------------------------
CREATE TABLE intro_conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES intro_conversations(id) ON DELETE CASCADE,
  participant_type TEXT NOT NULL
    CHECK (participant_type IN ('business', 'talent', 'salesperson', 'staff')),
  participant_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'salesperson', 'observer')),
  last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, participant_type, participant_id)
);

CREATE INDEX intro_conversation_members_participant_idx
  ON intro_conversation_members (participant_type, participant_id);

-- ---------------------------------------------------------------------------
-- Meetings (created before messages so messages can FK here)
-- ---------------------------------------------------------------------------
CREATE TABLE intro_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES intro_conversations(id) ON DELETE CASCADE,
  proposed_by_type TEXT NOT NULL
    CHECK (proposed_by_type IN ('business', 'talent', 'salesperson', 'staff', 'admin')),
  proposed_by_id UUID,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  timezone TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('meet', 'zoom', 'teams', 'other')),
  meeting_link TEXT,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'accepted', 'declined', 'cancelled', 'completed')),
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX intro_meetings_conversation_idx
  ON intro_meetings (conversation_id, starts_at);
CREATE INDEX intro_meetings_reminder_idx
  ON intro_meetings (starts_at)
  WHERE status IN ('proposed', 'accepted') AND reminder_sent_at IS NULL;

CREATE TRIGGER trg_intro_meetings_updated_at
  BEFORE UPDATE ON intro_meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
CREATE TABLE intro_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES intro_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL
    CHECK (sender_type IN ('business', 'talent', 'salesperson', 'staff', 'admin', 'system')),
  sender_id UUID,
  kind TEXT NOT NULL DEFAULT 'text'
    CHECK (kind IN ('text', 'meeting', 'system')),
  body TEXT,
  meeting_id UUID REFERENCES intro_meetings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX intro_messages_thread_idx
  ON intro_messages (conversation_id, created_at);
CREATE INDEX intro_messages_after_idx
  ON intro_messages (conversation_id, id);

-- ---------------------------------------------------------------------------
-- Internal staff notes (never shown to business or talent)
-- ---------------------------------------------------------------------------
CREATE TABLE intro_conversation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES intro_conversations(id) ON DELETE CASCADE,
  author_staff_id UUID,
  author_name TEXT,
  author_email TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX intro_conversation_notes_thread_idx
  ON intro_conversation_notes (conversation_id, created_at DESC);

CREATE TRIGGER trg_intro_conversation_notes_updated_at
  BEFORE UPDATE ON intro_conversation_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS — backend uses service role. No client policies.
-- ---------------------------------------------------------------------------
ALTER TABLE intro_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE intro_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE intro_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE intro_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE intro_conversation_notes ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Admin module registry
-- ---------------------------------------------------------------------------
INSERT INTO admin_modules (slug, name, section, sort) VALUES
  ('conversations', 'Conversations', 'Clients & Pipeline', 85)
ON CONFLICT (slug) DO NOTHING;
