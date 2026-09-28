-- One durable SquadHub question per SquadHire handoff. Service role only,
-- inherited from squad_bot_conversations' existing RLS and grants.
ALTER TABLE public.squad_bot_conversations
  ADD COLUMN IF NOT EXISTS hub_doubt_id uuid,
  ADD COLUMN IF NOT EXISTS hub_doubt_handoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS hub_execution_token uuid,
  ADD COLUMN IF NOT EXISTS hub_execution_outcome text,
  ADD COLUMN IF NOT EXISTS hub_execution_note text;

CREATE INDEX IF NOT EXISTS squad_bot_conversations_pending_hub_doubt_idx
  ON public.squad_bot_conversations (handoff_at)
  WHERE status = 'handoff' AND hub_doubt_id IS NULL;
