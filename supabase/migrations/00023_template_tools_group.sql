-- Migration: 00023_template_tools_group
-- Description: Add nullable "group" column to template_tools so tools for a
-- single category can be visually split into subsections (e.g., an accountant
-- profile separating "Accounting Software" from "Other Tools"). When the
-- column is null the profile form renders tools as a flat list (unchanged
-- behaviour for existing categories).

ALTER TABLE template_tools
  ADD COLUMN IF NOT EXISTS "group" TEXT;

CREATE INDEX IF NOT EXISTS template_tools_category_group_idx
  ON template_tools (category_id, "group", sort_order);
