-- Squad Bot on WhatsApp (Phase 4), via SquadHire CRM.
--
-- A WhatsApp sender may not have a SquadHire account yet (a new lead asking
-- about the Partner Program), so a conversation belongs to a talent OR to a
-- phone number. A talent's app and WhatsApp messages share one conversation.
-- crm_lead_id lets replies and alerts go back to the right CRM chat.

ALTER TABLE public.squad_bot_conversations
  ALTER COLUMN talent_user_id DROP NOT NULL,
  ADD COLUMN phone text UNIQUE,
  ADD COLUMN contact_name text,
  ADD COLUMN crm_lead_id uuid,
  ADD COLUMN crm_pipeline_name text,
  ADD CONSTRAINT squad_bot_conversations_owner_chk CHECK (talent_user_id IS NOT NULL OR phone IS NOT NULL);

-- The CRM message a WhatsApp line came from (inbound) or became (sent reply).
ALTER TABLE public.squad_bot_messages
  ADD COLUMN crm_message_id uuid;
