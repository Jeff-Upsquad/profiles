-- Run only in an empty disposable database, from this repository root.
\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE TABLE public.talent_users(id uuid PRIMARY KEY, full_name text, phone text);
\ir ../../supabase/migrations/20260926150000_squad_bot_chat.sql
\ir ../../supabase/migrations/20260926200000_squad_bot_whatsapp.sql
\ir ../../supabase/migrations/20260926230000_squad_bot_instructions.sql
\ir ../../supabase/migrations/20260928150000_squad_bot_channel_bridge.sql
\ir ../../supabase/migrations/20260928160000_support_chat.sql
INSERT INTO talent_users VALUES
 ('00000000-0000-4000-8000-000000000001','App user',null),
 ('00000000-0000-4000-8000-000000000002','WhatsApp only',null),
 ('00000000-0000-4000-8000-000000000003','Empty visit',null);
INSERT INTO squad_bot_conversations(id,talent_user_id) SELECT id,id FROM talent_users;
INSERT INTO squad_bot_messages(conversation_id,sender,channel,body,created_at) VALUES
 ('00000000-0000-4000-8000-000000000001','talent','app','App question','2026-09-28 00:00:00Z'),
 ('00000000-0000-4000-8000-000000000001','staff','app','App answer','2026-09-28 00:01:00Z'),
 ('00000000-0000-4000-8000-000000000001','instruction','app','Private instruction','2026-09-28 00:02:00Z'),
 ('00000000-0000-4000-8000-000000000001','talent','whatsapp','Newer WhatsApp','2026-09-28 00:03:00Z'),
 ('00000000-0000-4000-8000-000000000002','talent','whatsapp','WhatsApp only','2026-09-28 00:04:00Z');
DO $$ BEGIN
 IF (SELECT count(*) FROM support_chat_conversations) <> 1 THEN RAISE EXCEPTION 'Empty or WhatsApp-only chat leaked into Support Chat'; END IF;
 IF (SELECT last_body FROM support_chat_conversations LIMIT 1) <> 'App answer' THEN RAISE EXCEPTION 'Preview should be latest visible app message'; END IF;
 IF has_table_privilege('authenticated','support_chat_conversations','SELECT') THEN RAISE EXCEPTION 'Authenticated role must not read support directly'; END IF;
 IF NOT has_table_privilege('service_role','support_chat_conversations','SELECT') THEN RAISE EXCEPTION 'Worker lacks view grant'; END IF;
END $$;
