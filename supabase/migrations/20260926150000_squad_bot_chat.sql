-- Squad Bot — the talent help chat (Phase 2: in-app).
--
-- One conversation per talent. Squad Bot answers from the Knowledge Center
-- while status = 'bot'; when it can't (or the talent asks for a person) it
-- hands off: status = 'handoff' and the conversation waits in the admin
-- Squad Bot Inbox for a team reply. The team hands it back when done.
-- `channel` leaves room for WhatsApp via SquadHire CRM (Phase 4).

CREATE TABLE public.squad_bot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_user_id uuid NOT NULL UNIQUE REFERENCES public.talent_users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'bot' CHECK (status IN ('bot', 'handoff')),
  handoff_reason text,
  handoff_summary text,
  handoff_at timestamptz,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX squad_bot_conversations_inbox_idx
  ON public.squad_bot_conversations (status, last_message_at DESC);

CREATE TABLE public.squad_bot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.squad_bot_conversations(id) ON DELETE CASCADE,
  -- talent | bot | staff (a team reply) | system (handoff / hand-back markers)
  sender text NOT NULL CHECK (sender IN ('talent', 'bot', 'staff', 'system')),
  channel text NOT NULL DEFAULT 'app' CHECK (channel IN ('app', 'whatsapp')),
  body text NOT NULL,
  staff_user_id uuid,
  staff_name text,
  -- Model, token usage, knowledge used — for tuning and the learning loop.
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX squad_bot_messages_conversation_idx
  ON public.squad_bot_messages (conversation_id, created_at);

ALTER TABLE public.squad_bot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_bot_messages ENABLE ROW LEVEL SECURITY;

-- Backend (service role) only; talents and staff go through the API.
REVOKE ALL ON TABLE public.squad_bot_conversations FROM anon, authenticated;
REVOKE ALL ON TABLE public.squad_bot_messages FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.squad_bot_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.squad_bot_messages TO service_role;
