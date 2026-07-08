-- =============================================================
-- Notifications — click-through deep link
-- =============================================================
-- Job notifications ("You've been shortlisted!", interview calls, offers…)
-- need to open the thing they're about. link_url holds an in-app path
-- (e.g. /talent/job-openings/<recipientId>); the notifications UI navigates
-- there on click. NULL = not clickable (admin broadcasts unchanged).

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_url TEXT;
