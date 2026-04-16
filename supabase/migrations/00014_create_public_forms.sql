-- ============================================================
-- Public Forms configuration table
-- ============================================================

CREATE TABLE IF NOT EXISTS public_forms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type     TEXT NOT NULL UNIQUE,         -- e.g. 'creative', 'accountant'
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  url_path      TEXT NOT NULL,                -- e.g. '/apply/creative'
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE TRIGGER set_public_forms_updated_at
  BEFORE UPDATE ON public_forms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed the two existing forms
INSERT INTO public_forms (form_type, title, description, url_path, enabled) VALUES
  ('creative',   'Designer / Editor',  'Form for designers and editors arriving from Meta ads', '/apply/creative',   true),
  ('accountant', 'Accountant',         'Form for accountants arriving from Meta ads',           '/apply/accountant', true);

-- RLS
ALTER TABLE public_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on public_forms"
  ON public_forms
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anonymous read for form status checks
CREATE POLICY "Public read on public_forms"
  ON public_forms
  FOR SELECT
  TO anon
  USING (true);
