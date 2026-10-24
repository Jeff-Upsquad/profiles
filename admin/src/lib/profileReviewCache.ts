import type { QueryClient } from '@tanstack/react-query';

// Review decisions can change in another screen or another admin's session.
export const reviewStatusQueryOptions = {
  staleTime: 0,
  refetchOnMount: 'always' as const,
  refetchOnWindowFocus: true,
};

// Refresh on failure too: an already-completed review must not leave stale
// approval controls and onboarding badges on screen.
export async function invalidateProfileReviewQueries(queryClient: QueryClient) {
  await Promise.all([
    'review',
    'reviews',
    'onboarding-journey',
    'onboarding-hub',
    'onboarding-hub-stats',
    'talent-profile',
    'talent-profiles',
  ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}
