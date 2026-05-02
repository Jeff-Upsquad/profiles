CREATE TABLE how_it_works_videos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language   TEXT NOT NULL UNIQUE,
  loom_url   TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
