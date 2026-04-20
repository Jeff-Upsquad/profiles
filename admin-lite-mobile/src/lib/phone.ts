// Port of admin-lite/src/lib/phone.ts — strips duplicated country codes and
// formats Indian phone numbers as "+91 XXXXX XXXXX".

function stripDuplicatedCountry(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('9191') && digits.length > 11) return digits.slice(2);
  return digits;
}

export function formatIndianPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = stripDuplicatedCountry(raw);
  // 10 digits → add country code
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  // 12 digits starting with 91 → treat as +91 + 10
  if (digits.length === 12 && digits.startsWith('91')) {
    const local = digits.slice(2);
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return raw;
}

export function cleanPhoneForLink(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = stripDuplicatedCountry(raw);
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}
