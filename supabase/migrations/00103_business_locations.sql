-- =============================================================
-- Jobs module — saved interview locations per business
-- =============================================================
-- Physical-interview venues. Saved once, then picked from a dropdown in
-- the interview scheduler ("These locations will be saved to the
-- business's profile so they can be easily selected... for future
-- interviews").
-- =============================================================

CREATE TABLE business_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_user_id UUID NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                    -- 'HQ - Kochi Infopark'
  address TEXT NOT NULL,
  maps_url TEXT,                          -- Google Maps link
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX business_locations_owner_idx
  ON business_locations (business_user_id) WHERE is_active;

CREATE TRIGGER trg_business_locations_updated_at
  BEFORE UPDATE ON business_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE business_locations ENABLE ROW LEVEL SECURITY;
