-- 00136_wedding_and_events_category.sql
-- Video Editor already has separate "Wedding" and "Events" portfolio
-- genres. This copies those same two names onto Designer so both job
-- types share them. Idempotent.

INSERT INTO template_categories (category_id, name, sort_order, is_active)
SELECT c.id, v.name, v.sort_order, TRUE
FROM categories c
CROSS JOIN (VALUES
  ('Events',  0),
  ('Wedding', 0)
) AS v(name, sort_order)
WHERE c.slug = 'designer'
ON CONFLICT (category_id, name) DO NOTHING;
