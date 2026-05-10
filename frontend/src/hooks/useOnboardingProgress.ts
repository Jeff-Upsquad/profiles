import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export interface OnboardingProgress {
  signed_up: boolean;
  onboarding_completed: boolean;
  basic_profile_completed: boolean;
  job_profile_completed: boolean;
  portfolio_completed: boolean;
}

export interface OnboardingProgressResponse {
  progress: OnboardingProgress;
  all_completed_at: string | null;
}

export function useMyOnboardingProgress() {
  return useQuery<OnboardingProgressResponse>({
    queryKey: ['myOnboardingProgress'],
    queryFn: async () => {
      const { data } = await api.get('/talent/me/onboarding-progress');
      return data;
    },
  });
}
