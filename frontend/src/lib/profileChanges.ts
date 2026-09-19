import type { Profile } from '@/types';

export function hasOpenProfileChanges(profile: Profile): boolean {
  return profile.status === 'changes_requested' || (
    profile.status === 'approved' &&
    !!profile.changes_requested_at &&
    profile.reviewed_at == null
  );
}

export function needsProfileResubmission(profile: Profile): boolean {
  return hasOpenProfileChanges(profile) && !profile.resubmitted_at;
}

export interface BasicChangeState {
  changes_requested_at?: string | null;
  reviewed_at?: string | null;
  resubmitted_at?: string | null;
}

/** The basic profile is always live — openness is timestamp-derived. */
export function hasOpenBasicChanges(basic: BasicChangeState | null | undefined): boolean {
  return !!basic?.changes_requested_at && basic.reviewed_at == null;
}

export function needsBasicResubmission(basic: BasicChangeState | null | undefined): boolean {
  return hasOpenBasicChanges(basic) && !basic?.resubmitted_at;
}
