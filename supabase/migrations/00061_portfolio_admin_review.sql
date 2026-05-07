-- Admin review columns: active/inactive toggle + optional comment
ALTER TABLE portfolio_items
  ADD COLUMN admin_is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN admin_comment  text;
