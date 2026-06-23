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
}
