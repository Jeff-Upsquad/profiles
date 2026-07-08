import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import type {
  BrandProfileSnapshot,
  BusinessProfileSnapshot,
  JobCardContentShape,
  JobProfileSnapshot,
} from '@/components/jobs/shared';

// Talent-side jobs hooks — bound to /api/talent/jobs (jobs-talent.routes.ts).

export type TalentJobsTab =
  | 'new'
  | 'accepted'
  | 'shortlisted'
  | 'call_for_interview'
  | 'interview'
  | 'selected'
  | 'rejected'
  | 'offer'
  | 'hired'
  | 'placed';

export type JobFunnelStage =
  | 'applied'
  | 'screening'
  | 'shortlisted'
  | 'interview_invited'
  | 'interview'
  | 'on_hold'
  | 'selected'
  | 'rejected'
  | 'offer'
  | 'hired'
  | 'placed'
  | 'withdrawn';

export interface JobPreferences {
  opted_in: boolean;
  opted_in_at: string | null;
  opted_out_at: string | null;
  preferred_countries: string[];
  preferred_states: string[];
  preferred_districts: string[];
  preferred_cities: string[];
  preferred_job_types: string[];
  open_to_relocation: boolean;
  expected_salary_monthly: number | null;
  notice_period_days: number | null;
}

export interface JobPreferencesInput {
  preferred_countries?: string[];
  preferred_states?: string[];
  preferred_districts?: string[];
  preferred_cities?: string[];
  preferred_job_types?: string[];
  open_to_relocation?: boolean;
  expected_salary_monthly?: number | null;
  notice_period_days?: number | null;
}

export interface JobFeedCard {
  id: string;
  external_id: string | null;
  content: JobCardContentShape;
  status: string;
  published_at: string | null;
  expires_at: string | null;
}

export interface TalentJobFeedItem {
  recipient_id: string | null;
  candidate_id: string | null;
  funnel_stage: JobFunnelStage | 'declined' | null;
  stage_changed_at: string | null;
  job_profile_id: string | null;
  card: JobFeedCard | null;
}

export interface JobCandidateRow {
  id: string;
  recipient_id: string;
  card_id: string;
  job_profile_id: string;
  talent_user_id: string;
  funnel_stage: JobFunnelStage;
  stage_changed_at: string;
  rejected_reason: string | null;
  hired_at: string | null;
  keep_card_open: boolean | null;
  joining_date: string | null;
  joined_at: string | null;
  created_at: string;
}

export interface TalentJobDetail {
  recipient: {
    id: string;
    status: 'pending' | 'accepted' | 'rejected';
    responded_at: string | null;
    cancelled_at: string | null;
    created_at: string;
  };
  candidate: JobCandidateRow | null;
  job_profile_id: string | null;
  card: JobFeedCard | null;
}

export interface TalentJobProfile {
  id: string;
  external_id: string | null;
  title: string;
  description: string | null;
  details: JobProfileSnapshot;
  business_snapshot: BusinessProfileSnapshot;
  brand_snapshot: BrandProfileSnapshot | Record<string, never> | null;
  status: string;
}

export interface JobQuestionForTalent {
  id: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  is_published: boolean;
  is_mine: boolean;
  asker_name: string | null;
  created_at: string;
}

// ─── Opt-in + preferences ────────────────────────────────────────────────────

export function useJobPreferences(opts: { enabled?: boolean } = {}) {
  return useQuery<JobPreferences>({
    queryKey: ['jobs', 'preferences'],
    queryFn: async () => {
      const { data } = await api.get<{ preferences: JobPreferences }>('/talent/jobs/opt-in');
      return data.preferences;
    },
    enabled: opts.enabled ?? true,
  });
}

export function useOptInToJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: JobPreferencesInput) => {
      const { data } = await api.post<{ preferences: JobPreferences }>('/talent/jobs/opt-in', prefs);
      return data.preferences;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success("You're in! We'll match you with job openings.");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to opt in');
    },
  });
}

export function useOptOutOfJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<{ preferences: JobPreferences }>('/talent/jobs/opt-in');
      return data.preferences;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Opted out of job openings');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to opt out');
    },
  });
}

export function useUpdateJobPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: JobPreferencesInput) => {
      const { data } = await api.put<{ preferences: JobPreferences }>('/talent/jobs/preferences', prefs);
      return data.preferences;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs', 'preferences'] });
      toast.success('Preferences saved');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save preferences');
    },
  });
}

// ─── Feed ────────────────────────────────────────────────────────────────────

export function useTalentJobs(tab: TalentJobsTab, opts: { enabled?: boolean } = {}) {
  return useQuery<TalentJobFeedItem[]>({
    queryKey: ['jobs', 'feed', tab],
    queryFn: async () => {
      const { data } = await api.get<{ jobs: TalentJobFeedItem[] }>('/talent/jobs', {
        params: { tab },
      });
      return data.jobs ?? [];
    },
    enabled: opts.enabled ?? true,
  });
}

export function useUnreadJobsCount(opts: { enabled?: boolean } = {}) {
  return useQuery<number>({
    queryKey: ['jobs', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get<{ count: number }>('/talent/jobs/unread-count');
      return data.count ?? 0;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: opts.enabled ?? true,
  });
}

export function useTalentJobDetail(recipientId: string | undefined) {
  return useQuery<TalentJobDetail>({
    queryKey: ['jobs', 'detail', recipientId],
    queryFn: async () => {
      const { data } = await api.get<TalentJobDetail>(`/talent/jobs/${recipientId}`);
      return data;
    },
    enabled: !!recipientId,
  });
}

export function useRespondToJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { recipientId: string; action: 'accept' | 'reject' }) => {
      const { data } = await api.patch(`/talent/jobs/${vars.recipientId}/respond`, {
        action: vars.action,
      });
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success(vars.action === 'accept' ? 'Application sent!' : 'Job declined');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Could not save your response');
    },
  });
}

/** Withdraw AFTER accepting — the respond endpoint is pending-only by design. */
export function useWithdrawApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { recipientId: string }) => {
      const { data } = await api.post(`/talent/jobs/${vars.recipientId}/withdraw`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Application withdrawn');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Could not withdraw your application');
    },
  });
}

// ─── Job profile view + Q&A ──────────────────────────────────────────────────

/** The viewer's own recipient on this profile's newest card (action bar). */
export interface JobProfileViewerRecipient {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | string;
  card_id: string;
}

export function useJobProfileView(jobProfileId: string | undefined) {
  return useQuery<{
    profile: TalentJobProfile;
    questions: JobQuestionForTalent[];
    recipient: JobProfileViewerRecipient | null;
  }>({
    queryKey: ['jobs', 'profile', jobProfileId],
    queryFn: async () => {
      const { data } = await api.get<{
        profile: TalentJobProfile;
        questions: JobQuestionForTalent[];
        recipient: JobProfileViewerRecipient | null;
      }>(`/talent/jobs/profiles/${jobProfileId}`);
      return data;
    },
    enabled: !!jobProfileId,
  });
}

export function useAskJobQuestion(jobProfileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { question: string; card_id?: string }) => {
      const { data } = await api.post(`/talent/jobs/profiles/${jobProfileId}/questions`, vars);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs', 'profile', jobProfileId] });
      toast.success("Question sent — you'll be notified when it's answered.");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to send question');
    },
  });
}
