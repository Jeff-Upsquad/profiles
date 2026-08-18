-- Snapshot the visible sender name on each intro message.
--
-- SquadHub's Client View can open a room and send as a Leads/admin user.
-- Those people are not the business user, and they may not have a staff_users
-- row. Persist the display name at write time so the talent sees "Jeff", not
-- the business company name (or a generic "UpSquad").

ALTER TABLE intro_messages
  ADD COLUMN IF NOT EXISTS sender_display_name TEXT;
