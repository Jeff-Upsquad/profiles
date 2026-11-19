// Display helpers for the Social Media Creator sections of job profiles.
// The structured platforms/services data is stored as free-form JSON in
// field_data, so the public profile (and this admin preview) coerces it here.

export const CREATOR_CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  AED: 'AED ',
  EUR: '€',
  GBP: '£',
  SGD: 'S$',
};

export interface CreatorPlatformEntry {
  id: string;
  platform: string;
  profile_url: string;
  followers: number | '';
  languages: string[];
  location_scope: 'global' | 'specific';
  location: {
    country: string;
    state: string;
    district: string;
    city: string;
  };
  niches: string[];
  formats: string[];
}

export interface CreatorRateEntry {
  currency: string;
  amount: number | '';
}

export interface CreatorServiceEntry {
  service: string;
  /** Rates keyed by the platform entry's id they belong to. */
  rates: Record<string, CreatorRateEntry>;
  /** Months the brand may reuse the content (usage rights). Defaults to 1 year. */
  usage_rights_months?: number;
  /** Months the brand may run the content as paid advertising. Defaults to 1 year. */
  paid_ads_months?: number;
}

/** How long the brand can use the creator's content when the creator doesn't
 * pick a custom period — 1 year. */
export const DEFAULT_USAGE_RIGHTS_MONTHS = 12;

/** Clamp a stored months value back into the 1–60 range, falling back to the
 * 1-year default for older rows that predate the months fields. */
function coerceUsageMonths(value: unknown): number {
  const months = Number(value);
  if (!Number.isFinite(months) || months < 1) return DEFAULT_USAGE_RIGHTS_MONTHS;
  return Math.min(60, Math.round(months));
}

/** Coerce unknown field_data into the platform shape, tolerating older rows
 * (single-select `format` strings are folded into the `formats` array). */
export function coerceCreatorPlatforms(value: unknown): CreatorPlatformEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map((p) => {
      const formats = Array.isArray(p.formats)
        ? p.formats.filter((f): f is string => typeof f === 'string')
        : typeof p.format === 'string' && p.format
          ? [p.format]
          : [];
      const { format: _legacy, ...rest } = p;
      return { ...rest, formats } as CreatorPlatformEntry;
    });
}

/** Coerce unknown field_data into the services shape, tolerating older rows. */
export function coerceCreatorServices(value: unknown): CreatorServiceEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is CreatorServiceEntry => !!s && typeof s === 'object' && !!s.service)
    .map((s) => ({
      ...s,
      rates: s.rates && typeof s.rates === 'object' ? s.rates : {},
      usage_rights_months: coerceUsageMonths(s.usage_rights_months),
      paid_ads_months: coerceUsageMonths(s.paid_ads_months),
    }));
}

/** "12 months (1 year)"-style label for the usage period steppers. */
export function usageMonthsLabel(months: number): string {
  if (months % 12 === 0 && months >= 12) {
    const years = months / 12;
    return `${months} month${months === 1 ? '' : 's'} (${years} year${years === 1 ? '' : 's'})`;
  }
  return `${months} month${months === 1 ? '' : 's'}`;
}

/** Location display: "Global" or the selected country → city chain. */
export function creatorLocationLabel(
  scope: CreatorPlatformEntry['location_scope'],
  location: CreatorPlatformEntry['location'],
): string {
  if (scope !== 'specific') return 'Global';
  return [location.city, location.district, location.state, location.country]
    .filter(Boolean)
    .join(', ') || '—';
}
