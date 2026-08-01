// Phone-number helpers shared by the business auth / provisioning / subscription
// lookups. The `contact_phone_normalized` column on business_users is a generated
// digits-only projection of `contact_phone`, but the *stored* value may or may
// not carry a country code: self-serve signup stores the phone with its country
// code (e.g. "+91…" → "91…"), while the login form and older invite/provision
// paths send the bare national number. Matching on the trailing 10 digits keeps
// all of these tolerant of the country-code prefix — the same rule the
// `check_contact_exists` RPCs use (`right(contact_phone_normalized, 10)`).

// Digits-only normalization of a phone identifier.
export function normalizePhoneDigits(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '');
}

// The trailing 10 digits used to match against contact_phone_normalized, or null
// when there's nothing to match on. Pure digits, so it's always a safe LIKE
// pattern suffix (no wildcards to escape).
export function phoneMatchSuffix(phone: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return null;
  return digits.slice(-10);
}
