-- =============================================================
-- Jobs module — offers + negotiation thread
-- =============================================================
-- Offer letter TEMPLATES are canonical on SquadHub (admin authors them
-- there; the business-portal composer pulls the template via SquadHub's
-- signed integration GET and edits sections/package per offer). There is
-- deliberately NO offer_templates table here — only the per-offer frozen
-- letter.
--
-- Negotiation state machine (service-enforced in offers.service.ts):
--   sent -> (talent negotiate{figure}, only while is_final_counter=false)
--        -> negotiating -> business: accept-negotiation | decline-negotiation
--                          | counter (sets is_final_counter=true -> 'countered')
--   from countered: talent may only accept / decline / ask a question.
-- One LIVE offer per candidate (history rows stay as declined/withdrawn/
-- expired).
-- =============================================================

CREATE TABLE job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES job_candidates(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES subscription_cards(id) ON DELETE CASCADE,
  job_profile_id UUID NOT NULL REFERENCES job_profiles(id) ON DELETE CASCADE,
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  squadhub_template_id TEXT,              -- SquadHub offer_letter_templates.id (reference only)
  delivery_mode TEXT NOT NULL DEFAULT 'platform'
    CHECK (delivery_mode IN ('platform','manual_email')),
  position_title TEXT NOT NULL,
  effective_date DATE,
  join_by_date DATE,
  expires_on DATE,
  compensation JSONB NOT NULL DEFAULT '{}',
    -- {currency, training:{amount,cadence}, probation:{amount,cadence},
    --  confirmed:{amount,cadence}}  cadence: 'per_month' | 'per_annum'
  letter JSONB,                           -- frozen render at send: {sections[], merge_values{}, signatory{}}
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','negotiating','countered','accepted',
                      'declined','withdrawn','expired')),
  is_final_counter BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One live offer per candidate (history preserved on terminal rows).
CREATE UNIQUE INDEX job_offers_one_open_per_candidate ON job_offers (candidate_id)
  WHERE status IN ('draft','sent','negotiating','countered','accepted');
CREATE INDEX job_offers_card_idx   ON job_offers (card_id, status);
CREATE INDEX job_offers_talent_idx ON job_offers (talent_user_id, created_at DESC);

CREATE TRIGGER trg_job_offers_updated_at
  BEFORE UPDATE ON job_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- The negotiation thread + audit ("these actions will be listed down in
-- the job card").
CREATE TABLE offer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('business','talent','admin','system')),
  actor_id UUID,
  action TEXT NOT NULL CHECK (action IN ('created','package_updated','sent',
    'marked_sent_manually','viewed','accepted','declined','negotiation_requested',
    'counter_offered','negotiation_accepted','negotiation_declined',
    'question_asked','question_answered','withdrawn','expired')),
  amount JSONB,                            -- asked figure / counter package
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX offer_events_offer_idx ON offer_events (offer_id, created_at);

ALTER TABLE job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_events ENABLE ROW LEVEL SECURITY;
