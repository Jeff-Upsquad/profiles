import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useTalentMe } from '@/hooks/useTalentMe';
import { useMyProfiles } from '@/hooks/useProfiles';
import { pendingBasicSections, profilePendingState, type BasicSectionId } from '@/lib/talentCompletion';

export interface TalentPendingTasks {
  /** Mandatory basic-profile sections still incomplete. */
  basicSections: BasicSectionId[];
  /** Job profiles that are drafts or awaiting a resubmit. */
  pendingProfiles: number;
  /** No job profile created yet. */
  noProfiles: boolean;
  basicPending: boolean;
  profilesPending: boolean;
  /** Anything at all pending — drives the mobile "More" tab dot. */
  anyPending: boolean;
}

/**
 * Drives the "Pending" tags on the talent sidebar, bottom nav and More page.
 * Reuses the same query keys as the Basic Profile form and the job-profile
 * screens, so saving there refreshes the tags without extra wiring.
 */
export function useTalentPendingTasks({ enabled = true }: { enabled?: boolean } = {}): TalentPendingTasks {
  const { user } = useAuth();
  const isTalent = enabled && user?.role === 'talent';

  const { data: basic, isSuccess: basicLoaded } = useQuery<Record<string, any> | null>({
    queryKey: ['basicProfile'],
    queryFn: async () => {
      const { data } = await api.get('/talent/me/basic-profile');
      return data;
    },
    enabled: isTalent,
  });
  const { data: talentMe, isSuccess: meLoaded } = useTalentMe({ enabled: isTalent });
  const { data: profiles, isSuccess: profilesLoaded } = useMyProfiles({ enabled: isTalent });

  // Never flag anything until the data is in — a flash of "Pending" on every
  // page load would be noise.
  const basicSections =
    basicLoaded && meLoaded
      ? pendingBasicSections({
          fullName: talentMe?.full_name ?? user?.full_name,
          languages: talentMe?.languages_spoken,
          basic,
        })
      : [];
  const ownProfiles = profilesLoaded ? (profiles ?? []).filter((p) => !p.is_ghost) : [];
  const pendingProfiles = ownProfiles.filter((p) => profilePendingState(p) !== null).length;
  const noProfiles = profilesLoaded && ownProfiles.length === 0;

  const basicPending = basicSections.length > 0;
  const profilesPending = pendingProfiles > 0 || noProfiles;
  return {
    basicSections,
    pendingProfiles,
    noProfiles,
    basicPending,
    profilesPending,
    anyPending: basicPending || profilesPending,
  };
}
