-- Migration: 00028_portfolio_external_video_links
-- Description: Allow portfolio_items rows to reference an externally hosted
--              video (Google Drive, Dropbox, Loom, YouTube, Vimeo) instead of
--              a file uploaded to R2. Adds source_type/provider/external_url/
--              embed_url/thumbnail_url columns and a CHECK constraint that
--              keeps the two row shapes (upload vs link) coherent.
--
--              For link rows, file_url mirrors embed_url so existing reads
--              that select file_url keep working without code changes.

ALTER TABLE portfolio_items
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'upload'
    CHECK (source_type IN ('upload', 'link')),
  ADD COLUMN IF NOT EXISTS provider TEXT
    CHECK (provider IN ('youtube', 'vimeo', 'loom', 'gdrive', 'dropbox')),
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS embed_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

ALTER TABLE portfolio_items
  DROP CONSTRAINT IF EXISTS portfolio_items_link_fields_chk;

ALTER TABLE portfolio_items
  ADD CONSTRAINT portfolio_items_link_fields_chk CHECK (
    (
      source_type = 'upload'
      AND provider IS NULL
      AND external_url IS NULL
      AND embed_url IS NULL
    )
    OR (
      source_type = 'link'
      AND provider IS NOT NULL
      AND external_url IS NOT NULL
      AND embed_url IS NOT NULL
      AND file_type = 'video'
    )
  );

CREATE INDEX IF NOT EXISTS idx_portfolio_items_source_type
  ON portfolio_items (source_type);

COMMENT ON COLUMN portfolio_items.source_type IS
  'Whether the row references an uploaded R2 file (upload) or an externally hosted video link (link).';
COMMENT ON COLUMN portfolio_items.provider IS
  'External provider for link rows: youtube|vimeo|loom|gdrive|dropbox.';
COMMENT ON COLUMN portfolio_items.external_url IS
  'Original share URL the user pasted (canonical/normalized form).';
COMMENT ON COLUMN portfolio_items.embed_url IS
  'URL used as iframe src or <video src> for inline playback.';
COMMENT ON COLUMN portfolio_items.thumbnail_url IS
  'Optional poster image URL (deterministic for YouTube, oEmbed-fetched for Vimeo).';
