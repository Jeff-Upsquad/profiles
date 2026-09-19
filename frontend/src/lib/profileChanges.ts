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
