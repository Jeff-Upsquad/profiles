// Social Media Creator job profile — the structured Basic Info / Platforms /
// Services & Rates form. Option lists mirror the category's DB field options
// where one exists (creator_type, creator_gender); the platforms/services
// sections are stored as free-form JSON in field_data, so their option lists
// live here only.

export const CREATOR_ACCOUNT_TYPES = [
  { label: 'Individual creator', value: 'Individual creator' },
  { label: 'Channel', value: 'Channel' },
  { label: 'Collective', value: 'Collective' },
];

export const CREATOR_PLATFORM_OPTIONS = [
  'YouTube',
  'Instagram',
  'TikTok',
  'LinkedIn',
  'Facebook',
  'X / Twitter',
  'Other',
];

export const CREATOR_NICHE_OPTIONS = [
  'Lifestyle',
  'Fashion / beauty',
  'Food',
  'Travel',
  'Technology',
  'Education',
  'Fitness / wellness',
  'Gaming',
  'Entertainment',
  'Business / finance',
  'Other',
];

export const CREATOR_FORMAT_OPTIONS = [
  'Reels / Shorts / TikToks',
  'Long-form videos',
  'Stories',
  'Static posts / carousels',
  'Live streams',
  'Product reviews',
  'UGC for brand channels',
  'Other',
];

export interface CreatorServiceOption {
  service: string;
  description: string;
  /** false → rendered as "Coming soon" and not selectable. */
  live: boolean;
}

export const CREATOR_SERVICE_OPTIONS: CreatorServiceOption[] = [
  {
    service: 'Brand promotion',
    description: 'Promote the client\'s brand, product, or service directly by introducing its features and benefits, with mentions or collaborations featuring the brand\'s social media page or channel.',
    live: true,
  },
  {
    service: 'Creative promotion',
    description: 'Promote the client\'s brand, product, or service through an original concept, engaging script, or creative storytelling developed and produced by the creator.',
    live: true,
  },
  {
    service: 'Sponsored posts',
    description: 'Publish posts featuring a brand or product for a fee, on your platforms.',
    live: false,
  },
  {
    service: 'UGC production',
    description: 'Produce user-generated-style content the brand publishes on its own channels.',
    live: false,
  },
  {
    service: 'Product reviews',
    description: 'Honest reviews and first impressions of products or services.',
    live: false,
  },
  {
    service: 'Affiliate content',
    description: 'Content carrying tracked links or codes that earn you commission on sales.',
    live: false,
  },
  {
    service: 'Event coverage',
    description: 'Cover launches and events through live updates or recap content.',
    live: false,
  },
  {
    service: 'Live hosting',
    description: 'Host live streams, sessions or takeovers for a brand.',
    live: false,
  },
  {
    service: 'Other',
    description: 'Anything else you offer that does not fit the services above.',
    live: false,
  },
];

/** Services that can currently be selected on the creator job profile. */
export const LIVE_CREATOR_SERVICES = CREATOR_SERVICE_OPTIONS.filter((s) => s.live).map((s) => s.service);

// Same language list as the talent LanguagePicker.
export const CREATOR_LANGUAGE_OPTIONS = [
  'Hindi',
  'Bengali',
  'Telugu',
  'Marathi',
  'Tamil',
  'Urdu',
  'Gujarati',
  'Kannada',
  'Malayalam',
  'Odia',
  'English',
];

export const CREATOR_CURRENCY_OPTIONS = [
  { label: 'INR ₹ Indian Rupee', value: 'INR' },
  { label: 'USD $ US Dollar', value: 'USD' },
  { label: 'AED د.Em UAE Dirham', value: 'AED' },
  { label: 'EUR € Euro', value: 'EUR' },
  { label: 'GBP £ British Pound', value: 'GBP' },
  { label: 'SGD S$ Singapore Dollar', value: 'SGD' },
];

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
 * pick a custom period — 1 year. The business brief steppers start here too. */
export const DEFAULT_USAGE_RIGHTS_MONTHS = 12;

/** Clamp a stored months value back into the 1–60 range, falling back to the
 * 1-year default for older rows that predate the months fields. */
function coerceUsageMonths(value: unknown): number {
  const months = Number(value);
  if (!Number.isFinite(months) || months < 1) return DEFAULT_USAGE_RIGHTS_MONTHS;
  return Math.min(60, Math.round(months));
}

export function newCreatorPlatform(): CreatorPlatformEntry {
  return {
    id: `plt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    platform: '',
    profile_url: '',
    followers: '',
    languages: [],
    location_scope: 'global',
    location: { country: '', state: '', district: '', city: '' },
    niches: [],
    formats: [],
  };
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

/**
 * Validate the structured creator sections. Returns errors keyed by field
 * (creator_* for basics, `creator_platforms.<id>.<field>` per platform card,
 * `creator_services.<service>` when a service has no platform rates and
 * `creator_services.<service>.<platformId>` per rate row) — the same record
 * shape the generic form validation uses.
 */
export function validateCreatorProfile(values: Record<string, any>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.creator_name || !String(values.creator_name).trim()) {
    errors.creator_name = 'Creator name is required';
  }
  if (!values.creator_gender) {
    errors.creator_gender = 'Gender is required';
  }
  const age = Number(values.creator_age);
  if (values.creator_age === '' || values.creator_age === undefined || values.creator_age === null || Number.isNaN(age)) {
    errors.creator_age = 'Age is required';
  } else if (age < 13 || age > 100 || !Number.isInteger(age)) {
    errors.creator_age = 'Age must be a whole number between 13 and 100';
  }
  if (!values.creator_type) {
    errors.creator_type = 'Account type is required';
  }

  const platforms = coerceCreatorPlatforms(values.creator_platforms);
  if (platforms.length === 0) {
    errors.creator_platforms = 'Add at least one social media platform';
  }
  for (const p of platforms) {
    const key = (field: string) => `creator_platforms.${p.id}.${field}`;
    if (!p.platform) errors[key('platform')] = 'Select a platform';
    const url = (p.profile_url || '').trim();
    if (!url) {
      errors[key('profile_url')] = 'Profile URL is required';
    } else if (url.startsWith('http') && !/^https?:\/\/.+\..+/.test(url)) {
      errors[key('profile_url')] = 'Enter a valid URL (https://…) or @handle';
    } else if (!url.startsWith('http') && !url.startsWith('@') && !/\.[a-z]{2,}/i.test(url)) {
      errors[key('profile_url')] = 'Enter a valid URL or @handle';
    }
    const followers = Number(p.followers);
    if (p.followers === '' || p.followers === undefined || Number.isNaN(followers) || followers < 0) {
      errors[key('followers')] = 'Enter your follower / subscriber count (0 is fine)';
    }
    if (!p.languages || p.languages.length === 0) {
      errors[key('languages')] = 'Select at least one language';
    }
    if (p.location_scope === 'specific') {
      if (!p.location.country) errors[key('country')] = 'Country is required';
      if (!p.location.state) errors[key('state')] = 'State is required';
    }
    if (!p.niches || p.niches.length === 0) {
      errors[key('niches')] = 'Select at least one niche';
    }
    if (!p.formats || p.formats.length === 0) {
      errors[key('formats')] = 'Select at least one content format';
    }
  }

  const services = coerceCreatorServices(values.creator_services);
  if (services.length === 0) {
    errors.creator_services = 'Select at least one service';
  }
  for (const s of services) {
    // Every platform entered above is offered as a rate row; only the ones the
    // creator actually filled in are required — a service is valid when at
    // least one platform carries a currency + positive amount.
    const hasValidRate = Object.values(s.rates ?? {}).some((rate) => {
      const amount = Number(rate?.amount);
      return !!rate && !!rate.currency && Number.isFinite(amount) && amount > 0;
    });
    if (!hasValidRate) {
      errors[`creator_services.${s.service}`] = 'Enter a rate for at least one platform';
    }
  }

  return errors;
}
