// Module-level access control shared between backend and the admin/staff apps.

/** Permission tiers, ordered low -> high. */
export type ModulePermission = 'view' | 'edit' | 'full' | 'admin';

/** Numeric rank for tier comparison (higher = more capable). */
export const MODULE_PERMISSION_RANK: Record<ModulePermission, number> = {
  view: 1,
  edit: 2,
  full: 3,
  admin: 4,
};

export const MODULE_PERMISSION_VALUES: ModulePermission[] = ['view', 'edit', 'full', 'admin'];

/**
 * True when `held` satisfies (is at least) the `required` tier.
 * `held` may be undefined (no grant), which never satisfies anything.
 */
export function meetsLevel(
  held: ModulePermission | undefined | null,
  required: ModulePermission,
): boolean {
  return !!held && MODULE_PERMISSION_RANK[held] >= MODULE_PERMISSION_RANK[required];
}

/** A staff user's grants as a slug -> tier map (the live, re-checked shape). */
export type ModuleGrants = Record<string, ModulePermission>;

/** A grantable admin module (registry row in `admin_modules`). */
export interface AdminModule {
  slug: string;
  name: string;
  section: string;
  sort: number;
  is_active: boolean;
}

/** A staff user as returned by the management API (never includes password_hash). */
export interface StaffUser {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** A single (module, tier) grant row for a staff user. */
export interface StaffModuleGrant {
  module_slug: string;
  permission: ModulePermission;
  /** Candidates only — intra-module scope. Absent/empty key = unrestricted. */
  scope?: CandidateScope | null;
}

// ── Candidates module: second access layer (categories + sections) ──────────

/** Lead categories (lead_submissions.form_type — fixed enum). */
export const CANDIDATE_CATEGORIES = [
  { value: 'creative', label: 'Creative' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'sales', label: 'Sales' },
] as const;

/** Candidates sub-sections (the three tabs). */
export const CANDIDATE_SECTIONS = [
  { value: 'applications', label: 'Applications' },
  { value: 'interviews', label: 'Interview Responses' },
  { value: 'onboarding', label: 'Onboarding' },
] as const;

export type CandidateCategory = (typeof CANDIDATE_CATEGORIES)[number]['value'];
export type CandidateSection = (typeof CANDIDATE_SECTIONS)[number]['value'];

export const CANDIDATE_CATEGORY_VALUES = CANDIDATE_CATEGORIES.map((c) => c.value);
export const CANDIDATE_SECTION_VALUES = CANDIDATE_SECTIONS.map((s) => s.value);

/**
 * Intra-module scope for a candidates grant. An absent or empty list on a
 * dimension means "all" on that dimension (deny nothing).
 */
export interface CandidateScope {
  categories?: string[];
  sections?: string[];
}

/** Per-module scope map (only `candidates` is meaningful today). */
export type ModuleScopes = Record<string, CandidateScope>;

/** True when `allowed` (the scope list) permits `value`. Empty/undefined = all. */
export function scopeAllows(allowed: string[] | undefined | null, value: string): boolean {
  return !allowed || allowed.length === 0 || allowed.includes(value);
}
