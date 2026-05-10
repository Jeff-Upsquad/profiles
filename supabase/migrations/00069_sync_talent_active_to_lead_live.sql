-- Set talent_users.is_active based on the linked lead's onboarding status.
-- Live -> active; anything else -> inactive. Talents with no linked lead are not touched.
UPDATE talent_users tu
SET is_active = (l.status = 'live'),
    updated_at = NOW()
FROM lead_submissions l
WHERE l.linked_talent_user_id = tu.id
  AND tu.is_active <> (l.status = 'live');
