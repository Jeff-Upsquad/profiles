-- Migration: 20261022150000_portfolio_captions_text_posts
-- Description: Portfolio items get an optional caption (shown above the work
--              in the public profile feed), and a new 'text' file_type for
--              text-only posts (e.g. a headline result). Text rows keep
--              source_type 'upload' with an empty file_url; the post body
--              lives in caption.

ALTER TABLE portfolio_items
  ADD COLUMN IF NOT EXISTS caption TEXT;

ALTER TABLE portfolio_items
  DROP CONSTRAINT IF EXISTS portfolio_items_file_type_check;

ALTER TABLE portfolio_items
  ADD CONSTRAINT portfolio_items_file_type_check
  CHECK (file_type IN ('image', 'pdf', 'video', 'text'));

ALTER TABLE portfolio_items
  DROP CONSTRAINT IF EXISTS portfolio_items_text_caption_chk;

ALTER TABLE portfolio_items
  ADD CONSTRAINT portfolio_items_text_caption_chk
  CHECK (file_type <> 'text' OR (caption IS NOT NULL AND length(btrim(caption)) > 0));

COMMENT ON COLUMN portfolio_items.caption IS
  'Optional caption for a work; required body text for file_type = text posts.';
