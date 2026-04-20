/**
 * Phone-number helpers. Handles a recurring data-quality issue in this project:
 * candidates sometimes type their number with the "91" country code prefix when
 * submitting, and the form also prepends "+91", so the stored value ends up with
 * a duplicated country code (e.g. "+91917080886087" for number 7080886087).
 *
 * We strip any leading "91"s until we arrive at a plausible 10-digit Indian mobile
 * number; if we can't, we fall back to the raw value unchanged.
 */

function strip91s(digits: string): string {
  let out = digits;
  while (out.length > 10 && out.startsWith('91')) {
    out = out.slice(2);
  }
  return out;
}

/** Format a stored phone for display, e.g. "+91 70808 86087". */
export function formatIndianPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = strip91s(raw.replace(/\D/g, ''));
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  // Not a 10-digit Indian number — preserve what we were given.
  return raw.startsWith('+') ? raw : `+${raw.replace(/\D/g, '')}`;
}

/**
 * Clean a stored phone to a digits-only international format suitable for
 * `tel:` and `wa.me/` links (no leading `+`, country code included).
 */
export function cleanPhoneForLink(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = strip91s(raw.replace(/\D/g, ''));
  return digits.length === 10 ? `91${digits}` : digits;
}
