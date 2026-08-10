-- =============================================================
-- Training SOPs — Systems & Procedures wiki (SQUADHUB-style)
-- =============================================================
-- Nested pages + content blocks. Share/complete uses training_assignments
-- (resource_type = 'sop') from 00117.

BEGIN;

-- ---------------------------------------------------------------------------
-- training_sops
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_sops (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  summary          TEXT,
  icon             TEXT,
  cover_image_url  TEXT,
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'published', 'archived')),
  available_to_all BOOLEAN NOT NULL DEFAULT false,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  published_at     TIMESTAMPTZ,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_sops_status
  ON training_sops (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_training_sops_sort
  ON training_sops (sort_order)
  WHERE deleted_at IS NULL;

CREATE TRIGGER set_training_sops_updated_at
  BEFORE UPDATE ON training_sops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Job-profile targeting
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_sop_categories (
  sop_id      UUID NOT NULL REFERENCES training_sops(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (sop_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_training_sop_categories_category
  ON training_sop_categories (category_id);

-- ---------------------------------------------------------------------------
-- Nested pages (wiki tree)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_sop_pages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id          UUID NOT NULL REFERENCES training_sops(id) ON DELETE CASCADE,
  parent_page_id  UUID REFERENCES training_sop_pages(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  icon            TEXT,
  position        INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_sop_pages_sop_parent
  ON training_sop_pages (sop_id, parent_page_id, position);

CREATE TRIGGER set_training_sop_pages_updated_at
  BEFORE UPDATE ON training_sop_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Content blocks on a page
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_sop_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id         UUID NOT NULL REFERENCES training_sop_pages(id) ON DELETE CASCADE,
  type            TEXT NOT NULL
                    CHECK (type IN ('text', 'image', 'video_embed', 'pdf')),
  position        INTEGER NOT NULL DEFAULT 0,
  text_content    JSONB,
  file_url        TEXT,
  file_name       TEXT,
  file_size       INTEGER,
  mime_type       TEXT,
  embed_url       TEXT,
  embed_provider  TEXT,
  caption         TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_sop_blocks_page
  ON training_sop_blocks (page_id, position);

CREATE TRIGGER set_training_sop_blocks_updated_at
  BEFORE UPDATE ON training_sop_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS (service role bypasses; authenticated select for published own-assignment
-- is enforced in API — keep policies simple)
-- ---------------------------------------------------------------------------
ALTER TABLE training_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sop_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sop_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sop_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_sops_select_authenticated ON training_sops
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND status = 'published');

CREATE POLICY training_sop_categories_select_authenticated ON training_sop_categories
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY training_sop_pages_select_authenticated ON training_sop_pages
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY training_sop_blocks_select_authenticated ON training_sop_blocks
  FOR SELECT TO authenticated
  USING (true);

COMMIT;
