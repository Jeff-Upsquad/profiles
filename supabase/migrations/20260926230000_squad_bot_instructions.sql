-- Squad Bot — private team instructions.
--
-- The team can tell Squad Bot what to do in a chat ("check their portfolio and
-- tell them what's missing", "the webinar details are at <link>"). These lines
-- never reach the talent; Squad Bot reads them as instructions, and the
-- learning loop treats them as the team's answer.

ALTER TABLE public.squad_bot_messages
  DROP CONSTRAINT IF EXISTS squad_bot_messages_sender_check;
ALTER TABLE public.squad_bot_messages
  ADD CONSTRAINT squad_bot_messages_sender_check
  CHECK (sender IN ('talent', 'bot', 'staff', 'system', 'instruction'));
