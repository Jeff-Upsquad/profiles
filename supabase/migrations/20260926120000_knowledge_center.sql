-- Knowledge Center — what Squad Bot knows.
--
-- The content is written in SquadHub Resources (track 'knowledge') and pushed
-- here on publish, like training. SquadHub owns the words; this is the
-- searchable copy the admin Knowledge Center browses and Squad Bot reads.
--
-- categories: 'general', 'tech', or a talent category slug (categories.slug),
-- so a new talent category gets its own knowledge with no schema change.

CREATE TABLE public.knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squadhub_item_id uuid NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  icon text,
  categories text[] NOT NULL DEFAULT '{}',
  -- Page titles + text flattened to plain text: what Squad Bot reads and search matches.
  body_text text NOT NULL DEFAULT '',
  -- The page tree as SquadHub sent it, for the admin reader.
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_items_categories_idx ON public.knowledge_items USING gin (categories);

-- Answers Squad Bot learned from a human handoff, waiting for an admin to
-- approve before they're saved to SquadHub as knowledge. Filled by the
-- learning loop (Phase 3); the admin queue reads it from day one.
CREATE TABLE public.knowledge_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  categories text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'handoff',
  source_ref text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  squadhub_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_suggestions_status_idx
  ON public.knowledge_suggestions (status, created_at DESC);

ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_suggestions ENABLE ROW LEVEL SECURITY;

-- Backend (service role) only; browsers go through the admin API.
REVOKE ALL ON TABLE public.knowledge_items FROM anon, authenticated;
REVOKE ALL ON TABLE public.knowledge_suggestions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.knowledge_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.knowledge_suggestions TO service_role;
