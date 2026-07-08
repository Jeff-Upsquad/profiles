-- =============================================================
-- Jobs module (hiring) — core tables
-- =============================================================
-- Hiring cards ride the EXISTING subscription_cards ingest with
-- card_type='hiring' (reserved in 00087). Everything hiring-specific lives
-- in satellite tables FK'd to the core pair (subscription_cards /
-- subscription_card_recipients) — no hiring columns on the shared tables.
--
-- talent_job_preferences: jobs-section opt-in + job preferences. NOTE:
-- preferred_districts was dropped from talent_users in 00008; it returns
-- here, scoped to the jobs module.
--
-- job_profiles: canonical job profile snapshot (upserted at card ingest
-- from content.job_profile, keyed by SquadHub's external_id). Q&A anchors
-- here so it survives card re-publishes and fresh broadcasts.
--
-- All access via the Express backend (service-role client) — RLS enabled
-- with no policies, matching recent migrations (00095/00098/00100).
-- =============================================================

CREATE TABLE talent_job_preferences (
  talent_user_id UUID PRIMARY KEY REFERENCES talent_users(id) ON DELETE CASCADE,
  opted_in_at TIMESTAMPTZ,                -- NULL = not opted in (matcher gate)
  opted_out_at TIMESTAMPTZ,               -- audit of last opt-out
  preferred_districts TEXT[] NOT NULL DEFAULT '{}',
  preferred_job_types TEXT[] NOT NULL DEFAULT '{}',
  open_to_relocation BOOLEAN NOT NULL DEFAULT false,
  expected_salary_monthly INTEGER,
  notice_period_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX talent_job_preferences_opted_in_idx
  ON talent_job_preferences (talent_user_id) WHERE opted_in_at IS NOT NULL;

CREATE TRIGGER trg_talent_job_preferences_updated_at
  BEFORE UPDATE ON talent_job_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE job_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL UNIQUE,       -- SquadHub job_profiles.id
  title TEXT NOT NULL,
  description TEXT,
  details JSONB NOT NULL DEFAULT '{}',    -- responsibilities, requirements, employment_type,
                                          -- work_mode, working_days/hours, salary band, benefits,
                                          -- growth_path, education, experience...
  business_snapshot JSONB NOT NULL DEFAULT '{}', -- {name, about, industry, size, website, socials,
                                                 --  logo_url, photos, culture, perks, locations[]}
  brand_snapshot JSONB NOT NULL DEFAULT '{}',    -- {} when the job hangs off the business itself
  business_user_id UUID REFERENCES business_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_job_profiles_updated_at
  BEFORE UPDATE ON job_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Hiring-specific card state (1:1 satellite of subscription_cards).
CREATE TABLE job_cards (
  card_id UUID PRIMARY KEY REFERENCES subscription_cards(id) ON DELETE CASCADE,
  job_profile_id UUID NOT NULL REFERENCES job_profiles(id) ON DELETE CASCADE,
  hiring_stage TEXT NOT NULL DEFAULT 'sourcing'
    CHECK (hiring_stage IN ('sourcing','screening','interviewing','offering','closed')),
  screening_started_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  close_mode TEXT CHECK (close_mode IN ('filled','cancelled')),
  openings INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX job_cards_profile_idx ON job_cards (job_profile_id);

CREATE TRIGGER trg_job_cards_updated_at
  BEFORE UPDATE ON job_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Per-candidate funnel row; created when the talent ACCEPTS the card.
CREATE TABLE job_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL UNIQUE
    REFERENCES subscription_card_recipients(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES subscription_cards(id) ON DELETE CASCADE,
  job_profile_id UUID NOT NULL REFERENCES job_profiles(id) ON DELETE CASCADE,
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  funnel_stage TEXT NOT NULL DEFAULT 'applied'
    CHECK (funnel_stage IN ('applied','screening','shortlisted','interview_invited',
      'interview','on_hold','selected','rejected','offer','hired','placed','withdrawn')),
  stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rejected_reason TEXT,
  hired_at TIMESTAMPTZ,
  keep_card_open BOOLEAN,                 -- Hire popup answer (audit)
  joining_date DATE,
  joined_at TIMESTAMPTZ,                  -- business marked joined -> 'placed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (card_id, talent_user_id)
);

CREATE INDEX job_candidates_card_stage_idx   ON job_candidates (card_id, funnel_stage);
CREATE INDEX job_candidates_talent_stage_idx ON job_candidates (talent_user_id, funnel_stage, created_at DESC);

CREATE TRIGGER trg_job_candidates_updated_at
  BEFORE UPDATE ON job_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Immutable audit log — "all actions logged on the job card".
CREATE TABLE job_candidate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES job_candidates(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES subscription_cards(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('talent','business','admin','system')),
  actor_id UUID,
  event_type TEXT NOT NULL,               -- 'stage_changed','question_asked','interview_confirmed',...
  from_stage TEXT,
  to_stage TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX job_candidate_events_candidate_idx ON job_candidate_events (candidate_id, created_at);
CREATE INDEX job_candidate_events_card_idx      ON job_candidate_events (card_id, created_at DESC);

ALTER TABLE talent_job_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_candidate_events ENABLE ROW LEVEL SECURITY;
