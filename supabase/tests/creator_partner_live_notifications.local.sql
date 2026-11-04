-- Standalone contract test. Run ONLY in a disposable profiles_creator_test DB.
\set ON_ERROR_STOP on
DO $$ BEGIN
  IF current_database() <> 'profiles_creator_test' THEN
    RAISE EXCEPTION 'Run only against the disposable profiles_creator_test database';
  END IF;
END $$;
BEGIN;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE TABLE talent_users (id uuid primary key, pipeline_stage text, partner_approval_status text,
  signup_form_type text, signup_categories text[]);
CREATE TABLE categories(id uuid primary key, slug text);
CREATE TABLE talent_profiles(id uuid primary key, talent_user_id uuid, category_id uuid, deleted_at timestamptz);
CREATE TABLE notifications(id uuid primary key default gen_random_uuid(), kind text, system_type text,
  title text, body text, link_url text);
CREATE TABLE notification_recipients(notification_id uuid, talent_user_id uuid);
CREATE TABLE crm_templates(id uuid primary key, workspace_id uuid, name text, status text, language text);
CREATE TABLE crm_system_automations(workspace_id uuid, event_type text, enabled boolean, template_id uuid,
  template_language text, body_param_keys jsonb, unique(workspace_id, event_type));
INSERT INTO crm_templates VALUES(gen_random_uuid(),gen_random_uuid(),'profile_live_notice','APPROVED','en_US');
\ir ../migrations/20261103200440_creator_partner_live_notifications.sql

DO $$
DECLARE creator uuid := gen_random_uuid(); legacy uuid := gen_random_uuid(); ordinary uuid := gen_random_uuid();
  mixed uuid := gen_random_uuid(); cat uuid := gen_random_uuid();
BEGIN
  INSERT INTO talent_users VALUES
    (creator,'final_review',null,'social_media_creator','{}'),
    (legacy,'final_review','approved','creative','{}'),
    (ordinary,'final_review','approved','creative','{}'),
    (mixed,'final_review','approved','creative',ARRAY['designer','social-media-creator']);
  INSERT INTO categories VALUES(cat,'social-media-creator');
  INSERT INTO talent_profiles VALUES(gen_random_uuid(),legacy,cat,null);
  -- Unrelated users are unaffected; same-stage retries do not duplicate.
  UPDATE talent_users SET pipeline_stage='live';
  UPDATE talent_users SET pipeline_stage='live';
  ASSERT (SELECT count(*) FROM notifications) = 3, 'one inbox notification per creator transition';
  ASSERT (SELECT count(*) FROM notification_recipients) = 3, 'recipient rows created atomically';
  ASSERT (SELECT count(*) FROM creator_live_notice_outbox) = 3, 'one WhatsApp job per creator transition';
  ASSERT NOT EXISTS(SELECT 1 FROM notification_recipients WHERE talent_user_id=ordinary), 'ordinary flow untouched';
  ASSERT EXISTS(SELECT 1 FROM creator_live_notice_outbox WHERE talent_user_id=legacy), 'legacy profile detection';
  ASSERT EXISTS(SELECT 1 FROM notifications WHERE link_url='/talent/subscriptions'), 'opportunities deep link';
  ASSERT NOT has_table_privilege('authenticated','creator_live_notice_outbox','SELECT'), 'queue inaccessible to clients';
  ASSERT NOT has_function_privilege('anon','notify_creator_partner_live()','EXECUTE'), 'trigger not callable by clients';
  -- A real return to Live is a new event, unlike a retry of the same stage.
  UPDATE talent_users SET pipeline_stage='final_review' WHERE id=creator;
  UPDATE talent_users SET pipeline_stage='live' WHERE id=creator;
  ASSERT (SELECT count(*) FROM creator_live_notice_outbox) = 4, 're-entry emits once';
  ASSERT EXISTS(SELECT 1 FROM crm_system_automations WHERE event_type='talent_creator_profile_live' AND enabled), 'approved WhatsApp mapping';
END $$;
ROLLBACK;
