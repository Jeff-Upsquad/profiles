-- The CRM Support Chat is a window onto Profiles' existing bot chat.
-- Preserve the source channel when linked talent and WhatsApp chats share a
-- conversation, so SquadHub guidance returns to the right place.
ALTER TABLE public.squad_bot_conversations
  ADD COLUMN handoff_channel text CHECK (handoff_channel IN ('app', 'whatsapp'));

-- Filter before pagination. WhatsApp-only chats and empty visits are excluded.
CREATE VIEW public.support_chat_conversations WITH (security_invoker = true) AS
SELECT c.*, t.full_name AS talent_name, t.phone AS talent_phone,
       last_app.body AS last_body, last_app.sender AS last_sender,
       last_app.created_at AS support_last_message_at
FROM public.squad_bot_conversations c
JOIN public.talent_users t ON t.id = c.talent_user_id
JOIN LATERAL (
  SELECT m.body, m.sender, m.created_at FROM public.squad_bot_messages m
  WHERE m.conversation_id = c.id AND m.channel = 'app' AND m.sender IN ('talent', 'bot', 'staff')
  ORDER BY m.created_at DESC, m.id DESC LIMIT 1
) last_app ON true
WHERE EXISTS (
  SELECT 1 FROM public.squad_bot_messages m
  WHERE m.conversation_id = c.id AND m.channel = 'app' AND m.sender = 'talent'
);
REVOKE ALL ON public.support_chat_conversations FROM anon, authenticated;
GRANT SELECT ON public.support_chat_conversations TO service_role;
CREATE INDEX squad_bot_messages_app_idx ON public.squad_bot_messages (conversation_id, created_at DESC)
  WHERE channel = 'app';
