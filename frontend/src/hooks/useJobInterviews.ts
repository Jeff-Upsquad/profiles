import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import type { JobLocationSnapshot } from '@/components/jobs/shared';

// Talent-side interview hooks — /api/talent/jobs/interview-invites.
// The meeting link / physical location stay null until the business clicks
// "Start Interview" for THIS invite (round.link_locked keys the lock UI).

export interface TalentInterviewInvite {
  id: string;
  rsvp: 'invited' | 'accepted' | 'declined';
  rsvp_at: string | null;
  queue_status:
    | 'none'
    | 'queued'
    | 'waitlisted'
    | 'in_progress'
    | 'done'
    | 'no_show'
    | 'not_joined'
    | 'removed';
  confirm_seq: number | null;
  confirmed_at: string | null;
  promoted_at: string | null;
  showed_up_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  outcome: 'selected' | 'rejected' | 'on_hold' | null;
}

export interface TalentInterviewRound {
  id: string;
  card_id: string;
  job_profile_id: string;
  round_no: number;
  title: string | null;
  mode: 'virtual' | 'physical';
  window_start: string;
  window_end: string;
  minutes_per_interview: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  confirm_opened_at: string | null;
  meeting_provider: string | null;
  meeting_link: string | null;
  location: JobLocationSnapshot | null;
  link_locked: boolean;
}

export interface TalentInviteItem {
  invite: TalentInterviewInvite;
  round: TalentInterviewRound;
  job: { title: string; business_name: string };
}

export interface InviteQueueSnapshot {
  invite: TalentInterviewInvite;
  round: TalentInterviewRound;
  queue: {
    position: number | null;
    approx_time: string | null;
    waitlist_position: number | null;
    capacity: number;
    queued_count: number;
    waitlist_count: number;
  };
}

export function useMyInterviewInvites(opts: { enabled?: boolean } = {}) {
  return useQuery<TalentInviteItem[]>({
    queryKey: ['job-interviews', 'invites'],
    queryFn: async () => {
      const { data } = await api.get<{ invites: TalentInviteItem[] }>(
        '/talent/jobs/interview-invites',
      );
      return data.invites ?? [];
    },
    enabled: opts.enabled ?? true,
  });
}

export function useRespondToInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { inviteId: string; action: 'accept' | 'decline' }) => {
      const { data } = await api.post(`/talent/jobs/interview-invites/${vars.inviteId}/respond`, {
        action: vars.action,
      });
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['job-interviews'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success(
        vars.action === 'accept' ? 'Interview accepted — see you there!' : 'Interview declined',
      );
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Could not save your response');
    },
  });
}

/** The T-10 "I'm available" tap — atomic FIFO ticket via the backend RPC. */
export function useConfirmAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { data } = await api.post<InviteQueueSnapshot>(
        `/talent/jobs/interview-invites/${inviteId}/confirm`,
      );
      return data;
    },
    onSuccess: (data, inviteId) => {
      qc.setQueryData(['job-interviews', 'queue', inviteId], data);
      qc.invalidateQueries({ queryKey: ['job-interviews'] });
      toast.success("You're in the queue!");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Could not confirm attendance');
    },
  });
}

/** Live queue position + approx time — clients poll every 20s. */
export function useInviteQueue(inviteId: string | undefined, opts: { poll?: boolean } = {}) {
  return useQuery<InviteQueueSnapshot>({
    queryKey: ['job-interviews', 'queue', inviteId],
    queryFn: async () => {
      const { data } = await api.get<InviteQueueSnapshot>(
        `/talent/jobs/interview-invites/${inviteId}/queue`,
      );
      return data;
    },
    enabled: !!inviteId,
    refetchInterval: opts.poll === false ? false : 20_000,
    refetchOnWindowFocus: true,
  });
}
