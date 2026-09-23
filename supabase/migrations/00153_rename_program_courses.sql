-- The two program courses shipped with a "SquadHire " prefix on their titles,
-- which talents see verbatim in Training. Strip it. 00152 seeds the corrected
-- names for a fresh database; this renames the rows that already exist.
--
-- The title is SquadHub-owned (training-sync.service.ts writes it on every
-- republish), so the matching `lms_items` rows in SquadHub must carry the same
-- names or the next sync restores the prefix.
UPDATE training_items
   SET title = 'Jobs Module Training'
 WHERE squadhub_item_id = '7f1e32db-469e-4bfc-88d9-97162358d1ee'
   AND title = 'SquadHire Jobs Module Training';

UPDATE training_items
   SET title = 'Partner Program Module Training'
 WHERE squadhub_item_id = 'ba493993-771d-4969-8e16-18489be875c0'
   AND title = 'SquadHire Partner Program Module Training';

-- The onboarding course carried the same prefix.
UPDATE training_items
   SET title = 'Talent Onboarding'
 WHERE squadhub_item_id = '615f79c4-8205-4c44-8306-2f11c6f93ccc'
   AND title = 'SquadHire Talent Onboarding';
