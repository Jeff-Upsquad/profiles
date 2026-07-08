import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import type { JobCardContentShape, JobLocationSnapshot } from '@/components/jobs/shared';
import type { JobFunnelStage, JobCandidateRow, TalentJobProfile } from '@/hooks/useJobs';
import type { JobOffer, OfferCompensation, OfferEvent, OfferLetter } from '@/hooks/useJobOffers';

// Business-side jobs hooks — bound to /api/business/jobs (jobs-business.routes.ts).

export type HiringStage = 'sourcing' | 'screening' | 'interviewing' | 'offering' | 'closed';

export interface JobCardSatellite {
  card_id: string;
  job_profile_id: string;
  hiring_stage: HiringStage;
  screening_started_at: string | null;
  closed_at: string | null;
  close_mode: 'filled' | 'cancelled' | null;
  openings: number;
}

export interface BusinessJobCardSummary {
  id: string;
  external_id: string | null;
  content: JobCardContentShape;
  status: string;
  published_at: string | null;
  expires_at: string | null;
  job_card: JobCardSatellite | null;
  funnel_counts: Partial<Record<JobFunnelStage, number>>;
  pending_recipients: number;
}

export interface BusinessJobCardDetail {
  card: {
    id: string;
    external_id: string | null;
    content: JobCardContentShape;
    status: string;
    published_at: string | null;
    expires_at: string | null;
  };
  job_card: JobCardSatellite;
  job_profile: TalentJobProfile | null;
  funnel_counts: Partial<Record<JobFunnelStage, number>>;
}

export interface JobCandidateForBusiness extends JobCandidateRow {
  talent_name: string | null;
}

export interface InterviewRound {
  id: string;
  card_id: string;
  job_profile_id: string;
  round_no: number;
  title: string | null;
  mode: 'virtual' | 'physical';
  window_start: string;
  window_end: string;
  minutes_per_interview: number;
  capacity: number;
  queue_seq: number;
  meeting_provider: string | null;
  meeting_link: string | null;
  location_id: string | null;
  location_snapshot: JobLocationSnapshot | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  day_before_notified_at: string | null;
  confirm_opened_at: string | null;
  created_by: string;
  created_at: string;
}

export interface InterviewRoundWithCounts extends InterviewRound {
  invite_counts: Record<string, number>;
}

export interface DayConsoleInvite {
  id: string;
  round_id: string;
  candidate_id: string;
  talent_user_id: string;
  rsvp: 'invited' | 'accepted' | 'declined';
  rsvp_at: string | null;
  queue_status: string;
  confirm_seq: number | null;
  confirmed_at: string | null;
  promoted_at: string | null;
  showed_up_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  outcome: 'selected' | 'rejected' | 'on_hold' | null;
  outcome_at: string | null;
  no_show_at: string | null;
  created_at: string;
  talent_name: string | null;
  approx_time: string | null;
}

export interface DayConsoleData {
  round: InterviewRound;
  buckets: {
    invited: DayConsoleInvite[];
    declined: DayConsoleInvite[];
    accepted_unconfirmed: DayConsoleInvite[];
    queue: DayConsoleInvite[];
    waitlist: DayConsoleInvite[];
    in_progress: DayConsoleInvite[];
    done: DayConsoleInvite[];
    absent: DayConsoleInvite[];
  };
}

export interface BusinessOffer extends JobOffer {
  talent_name: string | null;
}

export interface OfferTemplateSection {
  key: string;
  title: string;
  body_html: string;
}

export interface OfferCompensationSchemaRow {
  key: string;
  component: string;
  cadence: string;
}

/** Pulled from SquadHub (templates are canonical there — contract §1). */
export interface OfferTemplatePull {
  success: boolean;
  data: {
    template: {
      id: string | null;
      name: string;
      description?: string | null;
      sections: OfferTemplateSection[];
      merge_fields: Array<{ key: string; label: string; source: string }>;
      compensation_schema: OfferCompensationSchemaRow[];
      signatory: { name: string | null; title: string | null; signature_image_url?: string | null };
    };
    merge_context: {
      position: string | null;
      business_name: string | null;
      brand_name: string | null;
      join_by_date: string | null;
      package_min: number | null;
      package_max: number | null;
      package_currency: string | null;
      package_period: string | null;
      working_days: string | null;
      working_hours: string | null;
    };
  };
}

export interface CreateInterviewRoundInput {
  title?: string;
  mode: 'virtual' | 'physical';
  window_start: string;
  window_end: string;
  minutes_per_interview: number;
  meeting_provider?: 'meet' | 'zoom' | 'teams' | 'other';
  meeting_link?: string;
  location_id?: string;
  round_no?: number;
  candidate_ids: string[];
}

export interface OfferPackageInput {
  position_title?: string;
  effective_date?: string | null;
  join_by_date?: string | null;
  expires_on?: string | null;
  compensation?: OfferCompensation;
  squadhub_template_id?: string | null;
  delivery_mode?: 'platform' | 'manual_email';
}

function errMsg(err: any, fallback: string): string {
  return err?.response?.data?.message || err?.response?.data?.error || fallback;
}

// ─── Cards ───────────────────────────────────────────────────────────────────

export function useBusinessJobCards(enabled = true) {
  return useQuery<BusinessJobCardSummary[]>({
    queryKey: ['business-jobs', 'cards'],
    queryFn: async () => {
      const { data } = await api.get<{ cards: BusinessJobCardSummary[] }>('/business/jobs');
      return data.cards ?? [];
    },
    enabled,
  });
}

export function useBusinessJobCard(cardId: string | undefined) {
  return useQuery<BusinessJobCardDetail>({
    queryKey: ['business-jobs', 'card', cardId],
    queryFn: async () => {
      const { data } = await api.get<BusinessJobCardDetail>(`/business/jobs/${cardId}`);
      return data;
    },
    enabled: !!cardId,
  });
}

export function useStartScreening(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ screening_started_at: string; moved: number }>(
        `/business/jobs/${cardId}/start-screening`,
      );
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['business-jobs'] });
      toast.success(
        data.moved > 0
          ? `Screening started — ${data.moved} applicant${data.moved === 1 ? '' : 's'} moved to screening`
          : 'Screening started',
      );
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to start screening'));
    },
  });
}

export function useCloseJobCard(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ closed_at: string; withdrawn_offers: number }>(
        `/business/jobs/${cardId}/close`,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs'] });
      toast.success('Job post closed');
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to close job post'));
    },
  });
}

// ─── Candidates ──────────────────────────────────────────────────────────────

export function useJobCandidates(cardId: string | undefined, stage?: JobFunnelStage) {
  return useQuery<JobCandidateForBusiness[]>({
    queryKey: ['business-jobs', 'candidates', cardId, stage ?? 'all'],
    queryFn: async () => {
      const { data } = await api.get<{ candidates: JobCandidateForBusiness[] }>(
        `/business/jobs/${cardId}/candidates`,
        { params: stage ? { stage } : undefined },
      );
      return data.candidates ?? [];
    },
    enabled: !!cardId,
  });
}

export function useReviewCandidate(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      candidateId: string;
      action: 'shortlist' | 'reject' | 'on_hold' | 'select';
      reason?: string;
    }) => {
      const { data } = await api.post<{ candidate: JobCandidateForBusiness }>(
        `/business/jobs/${cardId}/candidates/${vars.candidateId}/review`,
        { action: vars.action, ...(vars.reason ? { reason: vars.reason } : {}) },
      );
      return data.candidate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs'] });
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to review candidate'));
    },
  });
}

export interface HireResult {
  candidate: JobCandidateRow;
  closed: boolean;
  remaining_openings: number;
}

export function useHireCandidate(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { candidateId: string; keep_open: boolean; joining_date: string }) => {
      const { data } = await api.post<HireResult>(
        `/business/jobs/${cardId}/candidates/${vars.candidateId}/hire`,
        { keep_open: vars.keep_open, joining_date: vars.joining_date },
      );
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['business-jobs'] });
      toast.success(data.closed ? 'Candidate hired — job post closed' : 'Candidate hired!');
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to hire candidate'));
    },
  });
}

export function useMarkJoined(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (candidateId: string) => {
      const { data } = await api.post<{ candidate: JobCandidateRow }>(
        `/business/jobs/${cardId}/candidates/${candidateId}/mark-joined`,
      );
      return data.candidate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs'] });
      toast.success('Marked as joined — candidate placed');
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to mark as joined'));
    },
  });
}

// ─── Q&A ─────────────────────────────────────────────────────────────────────

export interface JobQuestionForBusiness {
  id: string;
  job_profile_id: string;
  card_id: string | null;
  talent_user_id: string;
  question: string;
  answer: string | null;
  answered_by: string | null;
  answered_at: string | null;
  deleted_at: string | null;
  created_at: string;
  asker_name: string | null;
}

export function useJobQuestions(cardId: string | undefined) {
  return useQuery<JobQuestionForBusiness[]>({
    queryKey: ['business-jobs', 'questions', cardId],
    queryFn: async () => {
      const { data } = await api.get<{ questions: JobQuestionForBusiness[] }>(
        `/business/jobs/${cardId}/questions`,
      );
      return data.questions ?? [];
    },
    enabled: !!cardId,
  });
}

export function useAnswerJobQuestion(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { questionId: string; answer: string }) => {
      const { data } = await api.post(`/business/jobs/questions/${vars.questionId}/answer`, {
        answer: vars.answer,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs', 'questions', cardId] });
      toast.success('Answer published on the job profile');
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to answer question'));
    },
  });
}

export function useDeleteJobQuestion(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) => {
      const { data } = await api.delete(`/business/jobs/questions/${questionId}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs', 'questions', cardId] });
      toast.success('Question deleted');
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to delete question'));
    },
  });
}

// ─── Interview rounds ────────────────────────────────────────────────────────

export function useInterviewRounds(cardId: string | undefined) {
  return useQuery<InterviewRoundWithCounts[]>({
    queryKey: ['business-jobs', 'rounds', cardId],
    queryFn: async () => {
      const { data } = await api.get<{ rounds: InterviewRoundWithCounts[] }>(
        `/business/jobs/${cardId}/interview-rounds`,
      );
      return data.rounds ?? [];
    },
    enabled: !!cardId,
  });
}

export function useCreateInterviewRound(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInterviewRoundInput) => {
      const { data } = await api.post<{ round: InterviewRound }>(
        `/business/jobs/${cardId}/interview-rounds`,
        input,
      );
      return data.round;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs'] });
      toast.success('Interview round scheduled — candidates notified');
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to schedule interview round'));
    },
  });
}

export function useCancelInterviewRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (roundId: string) => {
      const { data } = await api.post<{ round: InterviewRound }>(
        `/business/jobs/interview-rounds/${roundId}/cancel`,
      );
      return data.round;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs'] });
      toast.success('Interview round cancelled');
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to cancel round'));
    },
  });
}

// ─── Interview-day console ───────────────────────────────────────────────────

/** Live console — auto-refetches every 15s while open. */
export function useDayConsole(roundId: string | undefined) {
  return useQuery<DayConsoleData>({
    queryKey: ['business-jobs', 'day-console', roundId],
    queryFn: async () => {
      const { data } = await api.get<DayConsoleData>(
        `/business/jobs/interview-rounds/${roundId}/console`,
      );
      return data;
    },
    enabled: !!roundId,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

function useInviteAction(roundId: string, path: string, successMsg: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { inviteId: string; body?: Record<string, unknown> }) => {
      const { data } = await api.post(
        `/business/jobs/interview-rounds/${roundId}/invites/${vars.inviteId}/${path}`,
        vars.body ?? {},
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs', 'day-console', roundId] });
      qc.invalidateQueries({ queryKey: ['business-jobs', 'candidates'] });
      if (successMsg) toast.success(successMsg);
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Action failed'));
    },
  });
}

export function useMarkShowedUp(roundId: string) {
  return useInviteAction(roundId, 'showed-up', 'Marked as showed up');
}

/** Reveals the meeting link to THAT candidate only. */
export function useStartInterview(roundId: string) {
  return useInviteAction(roundId, 'start', 'Interview started — link revealed to the candidate');
}

export function useMarkAbsent(roundId: string) {
  return useInviteAction(roundId, 'no-show', 'Recorded — next in line promoted if waitlisted');
}

export function useInterviewOutcome(roundId: string) {
  return useInviteAction(roundId, 'outcome', 'Outcome recorded');
}

// ─── Offers ──────────────────────────────────────────────────────────────────

export function useCardOffers(cardId: string | undefined) {
  return useQuery<BusinessOffer[]>({
    queryKey: ['business-jobs', 'offers', cardId],
    queryFn: async () => {
      const { data } = await api.get<{ offers: BusinessOffer[] }>(`/business/jobs/${cardId}/offers`);
      return data.offers ?? [];
    },
    enabled: !!cardId,
  });
}

/** Offer-letter template — pulled from SquadHub via the signed integration GET. */
export function useOfferTemplate(cardId: string | undefined, opts: { enabled?: boolean } = {}) {
  return useQuery<OfferTemplatePull>({
    queryKey: ['business-jobs', 'offer-template', cardId],
    queryFn: async () => {
      const { data } = await api.get<OfferTemplatePull>(`/business/jobs/${cardId}/offer-template`);
      return data;
    },
    enabled: !!cardId && (opts.enabled ?? true),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export interface CreateOffersResult {
  created: BusinessOffer[];
  skipped: Array<{ candidate_id: string; reason: string }>;
}

export function useCreateOffers(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: OfferPackageInput & { candidate_ids?: string[]; all_selected?: boolean },
    ) => {
      const { data } = await api.post<CreateOffersResult>(`/business/jobs/${cardId}/offers`, input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs', 'offers', cardId] });
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to create offers'));
    },
  });
}

export function useUpdateOffer(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { offerId: string; patch: OfferPackageInput }) => {
      const { data } = await api.patch<{ offer: BusinessOffer }>(
        `/business/jobs/offers/${vars.offerId}`,
        vars.patch,
      );
      return data.offer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs', 'offers', cardId] });
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to update offer'));
    },
  });
}

export function useSendOffer(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { offerId: string; letter?: OfferLetter }) => {
      const { data } = await api.post<{ offer: BusinessOffer }>(
        `/business/jobs/offers/${vars.offerId}/send`,
        vars.letter ? { letter: vars.letter } : {},
      );
      return data.offer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs'] });
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to send offer'));
    },
  });
}

export function useMarkOfferSentManually(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (offerId: string) => {
      const { data } = await api.post<{ offer: BusinessOffer }>(
        `/business/jobs/offers/${offerId}/mark-sent-manually`,
      );
      return data.offer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs'] });
      toast.success('Recorded as sent via your own email');
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to mark offer as sent'));
    },
  });
}

export function useAcceptNegotiation(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { offerId: string; compensation?: OfferCompensation; note?: string }) => {
      const { data } = await api.post<{ offer: BusinessOffer }>(
        `/business/jobs/offers/${vars.offerId}/accept-negotiation`,
        { ...(vars.compensation ? { compensation: vars.compensation } : {}), ...(vars.note ? { note: vars.note } : {}) },
      );
      return data.offer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs'] });
      toast.success("Negotiation accepted — it's a deal!");
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to accept negotiation'));
    },
  });
}

export function useDeclineNegotiation(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { offerId: string; note?: string }) => {
      const { data } = await api.post<{ offer: BusinessOffer }>(
        `/business/jobs/offers/${vars.offerId}/decline-negotiation`,
        vars.note ? { note: vars.note } : {},
      );
      return data.offer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs'] });
      toast.success('Negotiation declined — the original offer stands');
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to decline negotiation'));
    },
  });
}

/** Counteroffer — ALWAYS final: the talent can then only accept / decline / ask. */
export function useCounterOffer(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { offerId: string; compensation: OfferCompensation; note?: string }) => {
      const { data } = await api.post<{ offer: BusinessOffer }>(
        `/business/jobs/offers/${vars.offerId}/counter`,
        { compensation: vars.compensation, ...(vars.note ? { note: vars.note } : {}) },
      );
      return data.offer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs'] });
      toast.success('Final counteroffer sent');
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to send counteroffer'));
    },
  });
}

export function useWithdrawOffer(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (offerId: string) => {
      const { data } = await api.post<{ offer: BusinessOffer }>(
        `/business/jobs/offers/${offerId}/withdraw`,
      );
      return data.offer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-jobs'] });
      toast.success('Offer withdrawn');
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to withdraw offer'));
    },
  });
}

export function useAnswerOfferQuestion(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { offerId: string; answer: string }) => {
      const { data } = await api.post(`/business/jobs/offers/${vars.offerId}/answer-question`, {
        answer: vars.answer,
      });
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['business-jobs', 'offer-events', vars.offerId] });
      toast.success('Reply sent to the candidate');
    },
    onError: (err: any) => {
      toast.error(errMsg(err, 'Failed to send reply'));
    },
  });
}

export function useOfferEvents(offerId: string | undefined) {
  return useQuery<OfferEvent[]>({
    queryKey: ['business-jobs', 'offer-events', offerId],
    queryFn: async () => {
      const { data } = await api.get<{ events: OfferEvent[] }>(
        `/business/jobs/offers/${offerId}/events`,
      );
      return data.events ?? [];
    },
    enabled: !!offerId,
  });
}
