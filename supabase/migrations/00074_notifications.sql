-- Migration: 00074_notifications
-- Description: Admin-authored notifications to talent users.
--   - `notifications`            : the message (title, body, multi-media: image/pdf/loom)
--   - `notification_recipients`  : per-talent recipient row, tracks read state
--
-- Targeting is filter-based; the admin picks filters (approval_status, gender,
-- languages, location, active flag), the backend expands matching talent_users
-- into recipient rows at send time. The filter snapshot is kept in
-- `target_filters` for audit and for the "sent to X users" stat in the admin UI.

-- ---------------------------------------------------------------------------
-- Enum: notification kind
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE notification_kind AS ENUM ('broadcast', 'system');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- notifications: one row per message
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind notification_kind NOT NULL DEFAULT 'broadcast',
  -- Used only when kind='system' (e.g. interest_request, profile_approved, profile_rejected)
  system_type TEXT,
  title TEXT NOT NULL,
  body TEXT,
  -- Array of { type: 'image'|'pdf'|'loom', url: string, name?: string }
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Snapshot of admin filter selections at send time (audit + UI "sent to N")
  target_filters JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_created_at ON notifications (created_at DESC);
CREATE INDEX idx_notifications_created_by ON notifications (created_by);

-- ---------------------------------------------------------------------------
-- notification_recipients: per-talent state
-- ---------------------------------------------------------------------------
CREATE TABLE notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notification_id, talent_user_id)
);

CREATE INDEX idx_notification_recipients_inbox
  ON notification_recipients (talent_user_id, created_at DESC);

CREATE INDEX idx_notification_recipients_unread
  ON notification_recipients (talent_user_id)
  WHERE read_at IS NULL;

CREATE INDEX idx_notification_recipients_notif
  ON notification_recipients (notification_id);

-- ---------------------------------------------------------------------------
-- RLS
-- Server routes use the service-role client (bypasses RLS); these policies
-- are defense-in-depth for any direct PostgREST/anon access.
-- ---------------------------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;

-- Admins: full access to notifications
CREATE POLICY notifications_admin_all ON notifications
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Talents: can read notifications they are a recipient of
CREATE POLICY notifications_select_recipient ON notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM notification_recipients nr
      WHERE nr.notification_id = notifications.id
        AND nr.talent_user_id = auth.uid()
    )
  );

-- Admins: full access to recipient rows (for admin "sent to N / read by M" stats)
CREATE POLICY notification_recipients_admin_all ON notification_recipients
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Talents: read + update (mark as read) their own recipient rows
CREATE POLICY notification_recipients_select_own ON notification_recipients
  FOR SELECT USING (talent_user_id = auth.uid());

CREATE POLICY notification_recipients_update_own ON notification_recipients
  FOR UPDATE USING (talent_user_id = auth.uid())
  WITH CHECK (talent_user_id = auth.uid());
