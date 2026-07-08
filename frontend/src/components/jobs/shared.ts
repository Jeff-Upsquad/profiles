// Shared helpers for the Jobs module (talent + business surfaces).
// The content shapes mirror SquadHub's hiring-card payload builder
// (squadhireJobWebhook.ts) — self-contained job/business/brand snapshots.

export interface JobLocationSnapshot {
  label?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  google_maps_url?: string | null;
}

export interface JobProfileSnapshot {
  external_id?: string;
  title?: string;
  description?: string | null;
  responsibilities?: string[];
  requirements?: string[];
  skills?: string[];
  min_experience_years?: number | null;
  max_experience_years?: number | null;
  education?: string | null;
  employment_type?: string | null;
  work_mode?: string | null;
  working_days?: string[];
  working_hours?: { start?: string | null; end?: string | null } | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_period?: string | null;
  benefits?: string[];
  growth_path?: string | null;
  location?: JobLocationSnapshot | null;
  [key: string]: unknown;
}

export interface BusinessProfileSnapshot {
  external_id?: string;
  name?: string;
  about?: string | null;
  industry?: string | null;
  company_size?: string | null;
  website?: string | null;
  socials?: Record<string, unknown>;
  logo_url?: string | null;
  photos?: string[];
  culture?: string | null;
  perks?: string[];
  founded_year?: number | null;
  [key: string]: unknown;
}

export interface BrandProfileSnapshot {
  external_id?: string;
  name?: string;
  about?: string | null;
  industry?: string | null;
  website?: string | null;
  socials?: Record<string, unknown>;
  logo_url?: string | null;
  photos?: string[];
  [key: string]: unknown;
}

export interface JobCardContentShape {
  title?: string;
  brand_name?: string;
  description?: string | null;
  card_type?: string;
  job_profile?: JobProfileSnapshot;
  business_profile?: BusinessProfileSnapshot;
  brand_profile?: BrandProfileSnapshot | null;
  package_min?: number | null;
  package_max?: number | null;
  package_currency?: string | null;
  package_period?: string | null;
  package_notes?: string | null;
  openings_count?: number;
  expected_joining_date?: string | null;
  [key: string]: unknown;
}

export function jobTitle(content: JobCardContentShape | undefined | null): string {
  const c = content ?? {};
  if (typeof c.title === 'string' && c.title.trim()) return c.title.trim();
  if (typeof c.job_profile?.title === 'string' && c.job_profile.title.trim()) {
    return c.job_profile.title.trim();
  }
  return 'Job opening';
}

export function jobBusinessName(content: JobCardContentShape | undefined | null): string {
  const c = content ?? {};
  if (typeof c.brand_name === 'string' && c.brand_name.trim()) return c.brand_name.trim();
  if (typeof c.business_profile?.name === 'string' && c.business_profile.name.trim()) {
    return c.business_profile.name.trim();
  }
  return 'Business';
}

export function currencySymbol(currency: string | null | undefined): string {
  if (!currency || currency === 'INR') return '₹';
  return `${currency} `;
}

/** "₹15,000–₹20,000/month" from the card-level package (falls back to the profile range). */
export function packageLabel(content: JobCardContentShape | undefined | null): string | null {
  const c = content ?? {};
  const min = c.package_min ?? c.job_profile?.salary_min ?? null;
  const max = c.package_max ?? c.job_profile?.salary_max ?? null;
  if (min == null && max == null) return null;
  const currency = c.package_currency ?? c.job_profile?.salary_currency ?? 'INR';
  const period = c.package_period ?? c.job_profile?.salary_period ?? 'monthly';
  const sym = currencySymbol(currency);
  const fmt = (n: number) => `${sym}${n.toLocaleString()}`;
  const range =
    min != null && max != null && min !== max
      ? `${fmt(min)}–${fmt(max)}`
      : fmt((min ?? max) as number);
  return `${range}/${period === 'annual' || period === 'yearly' ? 'yr' : 'mo'}`;
}

export function jobLocationLabel(content: JobCardContentShape | undefined | null): string | null {
  const loc = content?.job_profile?.location;
  if (!loc) return null;
  return [loc.city, loc.region].filter(Boolean).join(', ') || loc.label || null;
}

/** "15 Jul 2026" from an ISO date or timestamp. */
export function fmtDate(s: string | null | undefined): string {
  const v = (s ?? '').trim();
  if (!v) return '';
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "15 Jul, 2:30 PM" from an ISO timestamp. */
export function fmtDateTime(s: string | null | undefined): string {
  const v = (s ?? '').trim();
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

/** "2:30 PM" from an ISO timestamp. */
export function fmtTime(s: string | null | undefined): string {
  const v = (s ?? '').trim();
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;

export function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

export function initials(name: string | undefined | null): string {
  if (!name) return 'T';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'T';
}

/** Human labels for the candidate funnel stages (job_candidates.funnel_stage). */
export const FUNNEL_STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview_invited: 'Call for interview',
  interview: 'Interview',
  on_hold: 'On hold',
  selected: 'Selected',
  rejected: 'Rejected',
  offer: 'Offer',
  hired: 'Hired',
  placed: 'Placed',
  withdrawn: 'Withdrawn',
  declined: 'Declined',
};

export type BadgeVariantName = 'green' | 'yellow' | 'red' | 'gray' | 'indigo' | 'blue';

export function funnelStageBadgeVariant(stage: string | null | undefined): BadgeVariantName {
  switch (stage) {
    case 'shortlisted':
    case 'selected':
    case 'hired':
    case 'placed':
      return 'green';
    case 'interview_invited':
    case 'interview':
    case 'offer':
      return 'indigo';
    case 'on_hold':
      return 'yellow';
    case 'rejected':
    case 'withdrawn':
    case 'declined':
      return 'red';
    default:
      return 'blue';
  }
}
