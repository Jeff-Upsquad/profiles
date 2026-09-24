-- Keep the current admin reason alongside the account-level visibility switch.
ALTER TABLE public.talent_users
  ADD COLUMN IF NOT EXISTS inactive_reason text,
  ADD COLUMN IF NOT EXISTS inactive_at timestamptz;
