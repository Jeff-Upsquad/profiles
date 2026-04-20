-- Migration: 00022_normalize_lead_phones
-- Description: Fix lead_submissions rows where the country code "91" was typed
-- twice (once selected in the form, once typed by the candidate), leaving
-- entries like "+91917080886087" for the real number 7080886087.
--
-- Strategy: strip all non-digits, then check if the result is one or more
-- "91" prefixes followed by exactly 10 more digits. If so, keep only the
-- trailing 10 digits and re-prefix with "+91". Non-Indian numbers and
-- already-correct rows are left untouched.
--
-- Idempotent — re-running leaves correctly-stored rows unchanged.

UPDATE lead_submissions
SET phone = '+91' || regexp_replace(
  regexp_replace(phone, '\D', '', 'g'),
  '^(91)+(\d{10})$',
  '\2'
)
WHERE regexp_replace(phone, '\D', '', 'g') ~ '^(91)+\d{10}$';
