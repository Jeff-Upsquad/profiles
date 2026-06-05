export type ProfileStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'inactive'
  | 'deleted';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/**
 * An item the talent has selected from a category's template list (e.g. an
 * accounting software, an "other tool") paired with a self-rated proficiency.
 * Used by `_accounting_software` and `_tools` in `field_data`.
 *
 * `level` is 1-5: 1=Learning, 2=Beginner, 3=Intermediate, 4=Advanced,
 * 5=Expert. The 5-label set is shared with the `_skills` read view
 * (which uses 1-10 internally and maps via `Math.ceil(level/2)`).
 */
export interface LeveledItem {
  name: string;
  level: number;
}

export const LEVEL_LABELS: Record<number, string> = {
  1: 'Learning',
  2: 'Beginner',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Expert',
};

/**
 * Coerce a single value from `field_data._accounting_software` /
 * `field_data._tools` into a `LeveledItem`.
 *
 * Accepts the current `{name, level}` shape AND the legacy plain-string
 * shape (the pre-proficiency versions). Falls back to `defaultLevel` (3 =
 * Intermediate) for legacy entries or entries with an out-of-range level.
 */
export function coerceLeveledItem(raw: unknown, defaultLevel = 3): LeveledItem | null {
  if (typeof raw === 'string') {
    return raw ? { name: raw, level: defaultLevel } : null;
  }
  if (raw && typeof raw === 'object' && typeof (raw as any).name === 'string') {
    const lvl = Number((raw as any).level);
    const clamped = Number.isFinite(lvl) ? Math.max(1, Math.min(5, Math.round(lvl))) : defaultLevel;
    return { name: (raw as any).name, level: clamped };
  }
  return null;
}

/** Coerce a list of mixed-shape entries into `LeveledItem[]`, dropping junk. */
export function coerceLeveledList(raw: unknown, defaultLevel = 3): LeveledItem[] {
  if (!Array.isArray(raw)) return [];
  const out: LeveledItem[] = [];
  for (const item of raw) {
    const coerced = coerceLeveledItem(item, defaultLevel);
    if (coerced) out.push(coerced);
  }
  return out;
}

export interface TalentUser {
  id: string;
  full_name: string;
  phone?: string;
  age?: number;
  gender?: string;
  native_place?: string;
  current_location?: string;
  languages_spoken?: { language: string; proficiency: string }[];
  profile_photo_url?: string;
  approval_status: ApprovalStatus;
  approved_at?: string;
  approved_by?: string;
  is_active: boolean;
  skip_onboarding?: boolean;
  skip_onboarding_at?: string | null;
  skip_onboarding_by?: string | null;
  skip_onboarding_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TalentProfile {
  id: string;
  talent_user_id: string;
  category_id: string;
  status: ProfileStatus;
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  field_data: Record<string, any>;
  resume_url?: string;
  is_active: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  category?: import('./category').Category;
  talent_user?: TalentUser;
}
