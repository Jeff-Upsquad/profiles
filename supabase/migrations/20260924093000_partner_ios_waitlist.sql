-- iOS interest from the SquadHub Partner download page. A row is created only
-- after the email and phone have been matched to the same SquadHire account.
CREATE TABLE public.partner_ios_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squadhire_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  phone text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('talent', 'business', 'agency')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX partner_ios_waitlist_created_at_idx
  ON public.partner_ios_waitlist (created_at DESC);

ALTER TABLE public.partner_ios_waitlist ENABLE ROW LEVEL SECURITY;

-- Only the SquadHire backend's service-role client may record or inspect this
-- list. Browser clients cannot read other people's contact details.
REVOKE ALL ON TABLE public.partner_ios_waitlist FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.partner_ios_waitlist TO service_role;
