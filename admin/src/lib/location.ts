// Best-effort country + state extraction from free-text location strings
// like "Kannur, Kerala", "ahemdabad gujarat", "Delhi", "Greater noida".
//
// Profiles store location in talent_users.current_location as freeform
// text. Until we have structured columns, we fuzzy-match against a
// known list of Indian states + UTs by case-insensitive substring.
// Unmatched strings (e.g. "vadodara", "Greater noida" — city-only)
// fall through to "Unknown".
//
// When we eventually add proper country/state columns, swap this util
// out for a direct read of those columns.

export type Country = 'India';
export const COUNTRIES: { value: Country; label: string }[] = [
  { value: 'India', label: 'India' },
];

// States + Union Territories of India. Order: states A-Z, UTs A-Z.
// Each entry: canonical label + lowercased aliases for matching.
const INDIA_STATES: { label: string; aliases: string[] }[] = [
  { label: 'Andhra Pradesh', aliases: ['andhra pradesh', 'andhra'] },
  { label: 'Arunachal Pradesh', aliases: ['arunachal pradesh', 'arunachal'] },
  { label: 'Assam', aliases: ['assam'] },
  { label: 'Bihar', aliases: ['bihar'] },
  { label: 'Chhattisgarh', aliases: ['chhattisgarh', 'chattisgarh'] },
  { label: 'Goa', aliases: ['goa'] },
  { label: 'Gujarat', aliases: ['gujarat', 'gujrat'] },
  { label: 'Haryana', aliases: ['haryana'] },
  { label: 'Himachal Pradesh', aliases: ['himachal pradesh', 'himachal'] },
  { label: 'Jharkhand', aliases: ['jharkhand'] },
  { label: 'Karnataka', aliases: ['karnataka'] },
  { label: 'Kerala', aliases: ['kerala', 'keralam'] },
  { label: 'Madhya Pradesh', aliases: ['madhya pradesh'] },
  { label: 'Maharashtra', aliases: ['maharashtra'] },
  { label: 'Manipur', aliases: ['manipur'] },
  { label: 'Meghalaya', aliases: ['meghalaya'] },
  { label: 'Mizoram', aliases: ['mizoram'] },
  { label: 'Nagaland', aliases: ['nagaland'] },
  { label: 'Odisha', aliases: ['odisha', 'orissa'] },
  { label: 'Punjab', aliases: ['punjab'] },
  { label: 'Rajasthan', aliases: ['rajasthan'] },
  { label: 'Sikkim', aliases: ['sikkim'] },
  { label: 'Tamil Nadu', aliases: ['tamil nadu', 'tamilnadu'] },
  { label: 'Telangana', aliases: ['telangana'] },
  { label: 'Tripura', aliases: ['tripura'] },
  { label: 'Uttar Pradesh', aliases: ['uttar pradesh'] },
  { label: 'Uttarakhand', aliases: ['uttarakhand', 'uttaranchal'] },
  { label: 'West Bengal', aliases: ['west bengal', 'wb'] },
  // Union Territories
  { label: 'Andaman and Nicobar Islands', aliases: ['andaman'] },
  { label: 'Chandigarh', aliases: ['chandigarh'] },
  { label: 'Dadra and Nagar Haveli and Daman and Diu', aliases: ['dadra', 'daman', 'diu'] },
  { label: 'Delhi', aliases: ['delhi', 'new delhi'] },
  { label: 'Jammu and Kashmir', aliases: ['jammu and kashmir', 'jammu', 'kashmir', 'j&k'] },
  { label: 'Ladakh', aliases: ['ladakh'] },
  { label: 'Lakshadweep', aliases: ['lakshadweep'] },
  { label: 'Puducherry', aliases: ['puducherry', 'pondicherry'] },
];

export const INDIA_STATE_LABELS = INDIA_STATES.map((s) => s.label);

export const UNKNOWN_STATE = 'Unknown';

export interface ResolvedLocation {
  country: Country | null;
  state: string;
}

/**
 * Try to extract a recognized Indian state or UT from a freeform
 * location string. Returns 'Unknown' if no state matches.
 */
export function resolveLocation(raw: string | null | undefined): ResolvedLocation {
  if (!raw) return { country: null, state: UNKNOWN_STATE };
  const lower = raw.toLowerCase();
  for (const s of INDIA_STATES) {
    for (const alias of s.aliases) {
      // Word-boundary-aware substring: match alias surrounded by start/end
      // or non-letter (so "andhra" doesn't match "andhras", but "kerala"
      // does match "kerala," and "Kerala.").
      const pattern = new RegExp(`(^|[^a-z])${escapeRegex(alias)}([^a-z]|$)`, 'i');
      if (pattern.test(lower)) {
        return { country: 'India', state: s.label };
      }
    }
  }
  return { country: null, state: UNKNOWN_STATE };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
