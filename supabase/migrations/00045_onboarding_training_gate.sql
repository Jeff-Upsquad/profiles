-- Track whether talent has completed onboarding training
ALTER TABLE talent_users
  ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Mark one chapter as the onboarding chapter (enforced as single in app code)
ALTER TABLE training_chapters
  ADD COLUMN is_onboarding BOOLEAN NOT NULL DEFAULT false;

-- Language tag per chapter, admin-set
ALTER TABLE training_chapters
  ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
