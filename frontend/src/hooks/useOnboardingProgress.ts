import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export interface OnboardingProgress {
  signed_up: boolean;
  onboarding_completed: boolean;
  basic_profile_completed: boolean;
  job_profile_completed: boolean;
  portfolio_completed: boolean;
  /** False when the talent's categories have no portfolio (sales, accountant). */
  portfolio_required?: boolean;
  /** Signed in on the SquadHire mobile app at least once. */
  app_downloaded?: boolean;
  /** Registered for an onboarding webinar (attendance is ticked by an admin). */
  webinar_registered?: boolean;
  webinar_attended?: boolean;
  /** Per-track course; null/absent = not applicable to this talent. */
  partner_course?: ProgramCourseStatus | null;
  jobs_course?: ProgramCourseStatus | null;
}

export interface ProgramCourseStatus {
  done: boolean;
  completed: number;
  total: number;
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
