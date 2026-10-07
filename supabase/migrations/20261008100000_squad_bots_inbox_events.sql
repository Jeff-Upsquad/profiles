-- Team replies written in the Squad Bots inbox that SquadHire has delivered.
-- The primary key is the Squad Bots message ID: a claim before sending means
-- two backend instances, or a restart, never deliver the same reply twice.
CREATE TABLE IF NOT EXISTS public.squad_bots_inbox_events (
  id uuid PRIMARY KEY,
  conversation_id uuid REFERENCES public.squad_bot_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.squad_bot_messages(id) ON DELETE SET NULL,
  outcome text NOT NULL DEFAULT 'claimed' CHECK (outcome IN ('claimed', 'sent', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.squad_bots_inbox_events ENABLE ROW LEVEL SECURITY;

-- Backend (service role) only.
REVOKE ALL ON TABLE public.squad_bots_inbox_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.squad_bots_inbox_events TO service_role;
