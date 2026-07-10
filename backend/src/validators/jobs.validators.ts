import { z } from 'zod';

// =============================================================
// Jobs module validators — talent + business surfaces and the inbound
// SquadHub admin-mirror webhooks (/api/webhooks/squadhub/jobs/*).
// =============================================================

// ─── Shared enums ──────────────────────────────────────────────────────────

export const jobFunnelStages = [
  'applied',
  'screening',
  'shortlisted',
  'interview_invited',
  'interview',
  'on_hold',
  'selected',
  'rejected',
  'offer',
  'hired',
  'placed',
  'withdrawn',
] as const;

export const talentJobsTabs = [
  'new',
  'accepted',
  'shortlisted',
  'call_for_interview',
  'interview',
  'selected',
  'rejected',
  'offer',
  'hired',
  'placed',
] as const;

const isoDateTime = z.string().datetime({ offset: true });
// DATE columns (joining_date, offer date fields) — plain YYYY-MM-DD.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

// ─── Talent side ───────────────────────────────────────────────────────────

const preferredLocationStateSchema = z.object({
  state: z.string().min(1).max(120),
  districts: z.array(z.string().min(1).max(120)).max(100).default([]),
  cities: z.array(z.string().min(1).max(120)).max(100).default([]),
});

const preferredLocationSchema = z.object({
  country: z.string().min(1).max(120),
  states: z.array(preferredLocationStateSchema).max(60).default([]),
});

export const jobPreferencesSchema = z.object({
  // Nested tree (source of truth). The flat arrays below are derived from it
  // in the service when preferred_locations is present; they remain accepted
  // for backward compatibility.
  preferred_locations: z.array(preferredLocationSchema).max(20).optional(),
  preferred_countries: z.array(z.string().min(1).max(120)).max(50).optional(),
  preferred_states: z.array(z.string().min(1).max(120)).max(50).optional(),
  preferred_districts: z.array(z.string().min(1).max(120)).max(200).optional(),
  preferred_cities: z.array(z.string().min(1).max(120)).max(200).optional(),
  preferred_job_types: z.array(z.string().min(1).max(120)).max(50).optional(),
  open_to_relocation: z.boolean().optional(),
  expected_salary_monthly: z.number().int().nonnegative().nullable().optional(),
  notice_period_days: z.number().int().nonnegative().nullable().optional(),
});

export const listJobsQuerySchema = z.object({
  tab: z.enum(talentJobsTabs).default('new'),
});

export const respondToJobSchema = z.object({
  action: z.enum(['accept', 'reject']),
});

export const jobRecipientIdParamSchema = z.object({
  recipientId: z.string().uuid(),
});

export const jobProfileIdParamSchema = z.object({
  jobProfileId: z.string().uuid(),
});

export const askJobQuestionSchema = z.object({
  question: z.string().min(3).max(2000),
  card_id: z.string().uuid().optional(),
});

export const inviteIdParamSchema = z.object({
  inviteId: z.string().uuid(),
});

export const inviteRespondSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

export const offerIdParamSchema = z.object({
  offerId: z.string().uuid(),
});

export const offerRespondSchema = z.object({
  action: z.enum(['accept', 'decline', 'negotiate']),
  // The asked figure for `negotiate` — either a plain number or a structured
  // package ({amount, cadence, ...}); stored verbatim in the offer_events thread.
  amount: z.union([z.number(), z.record(z.unknown())]).optional(),
  note: z.string().max(2000).optional(),
});

export const offerQuestionSchema = z.object({
  question: z.string().min(1).max(2000),
});

// ─── Business side ─────────────────────────────────────────────────────────

export const jobCardIdParamSchema = z.object({
  cardId: z.string().uuid(),
});

export const jobCandidateParamSchema = z.object({
  cardId: z.string().uuid(),
  candidateId: z.string().uuid(),
});

export const listCandidatesQuerySchema = z.object({
  stage: z.enum(jobFunnelStages).optional(),
});

export const reviewCandidateSchema = z.object({
  action: z.enum(['shortlist', 'reject', 'on_hold', 'select']),
  reason: z.string().max(2000).optional(),
});

const interviewRoundFields = {
  title: z.string().max(200).optional(),
  mode: z.enum(['virtual', 'physical']),
  window_start: isoDateTime,
  window_end: isoDateTime,
  minutes_per_interview: z.number().int().positive(),
  meeting_provider: z.enum(['meet', 'zoom', 'teams', 'other']).optional(),
  // Nullable so an edit can CLEAR the link (business day console / admin
  // "remove link"); updateRound writes null through to the column.
  meeting_link: z.string().max(2000).nullable().optional(),
  location_id: z.string().uuid().optional(),
  // Frozen venue for physical rounds scheduled from SquadHub admin — its
  // business_locations live in the other project, so it sends the snapshot
  // instead of an id we can't resolve here.
  location_snapshot: z
    .object({
      label: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      region: z.string().nullable().optional(),
      google_maps_url: z.string().nullable().optional(),
    })
    .optional(),
  round_no: z.number().int().positive().optional(),
};

export const createInterviewRoundSchema = z.object({
  ...interviewRoundFields,
  candidate_ids: z.array(z.string().uuid()).min(1).max(500),
});

export const updateInterviewRoundSchema = z
  .object({
    ...interviewRoundFields,
    mode: z.enum(['virtual', 'physical']).optional(),
    window_start: isoDateTime.optional(),
    window_end: isoDateTime.optional(),
    minutes_per_interview: z.number().int().positive().optional(),
  })
  .partial();

export const roundIdParamSchema = z.object({
  roundId: z.string().uuid(),
});

export const roundInviteParamSchema = z.object({
  roundId: z.string().uuid(),
  inviteId: z.string().uuid(),
});

export const markAbsentSchema = z.object({
  kind: z.enum(['no_show', 'not_joined']),
});

export const interviewOutcomeSchema = z.object({
  outcome: z.enum(['selected', 'rejected', 'on_hold']),
});

const offerPackageFields = {
  position_title: z.string().min(1).max(200).optional(),
  effective_date: isoDate.nullable().optional(),
  join_by_date: isoDate.nullable().optional(),
  expires_on: isoDate.nullable().optional(),
  // {currency, training:{amount,cadence}, probation:{...}, confirmed:{...}} —
  // free-form so the compensation-table shape can evolve without a migration.
  compensation: z.record(z.unknown()).optional(),
  squadhub_template_id: z.string().max(200).nullable().optional(),
  delivery_mode: z.enum(['platform', 'manual_email']).optional(),
};

export const createOffersSchema = z
  .object({
    candidate_ids: z.array(z.string().uuid()).max(200).optional(),
    all_selected: z.boolean().optional(),
    ...offerPackageFields,
  })
  .refine((v) => v.all_selected === true || (v.candidate_ids?.length ?? 0) > 0, {
    message: 'Provide candidate_ids or all_selected',
  });

export const updateOfferSchema = z.object(offerPackageFields);

export const sendOfferSchema = z.object({
  // Frozen verbatim into job_offers.letter at send: {sections[], merge_values{},
  // signatory{}} composed by the portal from the SquadHub template.
  letter: z.record(z.unknown()).optional(),
});

export const counterOfferSchema = z.object({
  compensation: z.record(z.unknown()),
  note: z.string().max(2000).optional(),
});

export const negotiationDecisionSchema = z.object({
  compensation: z.record(z.unknown()).optional(),
  note: z.string().max(2000).optional(),
});

export const answerOfferQuestionSchema = z.object({
  answer: z.string().min(1).max(2000),
});

export const hireCandidateSchema = z.object({
  keep_open: z.boolean(),
  joining_date: isoDate,
});

export const answerJobQuestionSchema = z.object({
  answer: z.string().min(1).max(4000),
});

export const jobQuestionIdParamSchema = z.object({
  questionId: z.string().uuid(),
});

export const businessLocationSchema = z.object({
  label: z.string().min(1).max(200),
  address: z.string().min(1).max(1000),
  maps_url: z.string().url().max(2000).nullable().optional(),
});

export const businessLocationIdParamSchema = z.object({
  locationId: z.string().uuid(),
});

export const businessNotificationIdParamSchema = z.object({
  notificationId: z.string().uuid(),
});

// ─── Inbound SquadHub admin-mirror webhooks ────────────────────────────────
// All resolve the card by SquadHub external_id and run the SAME service
// functions as the business routes, with actor {type:'admin',
// source:'squadhub'} — the source flag suppresses the echo outbox event.

const externalId = z.string().min(1).max(200);

export const jobsStageWebhookSchema = z.object({
  external_id: externalId,
  action: z.literal('start_screening'),
});

export const jobsCandidateReviewWebhookSchema = z.object({
  external_id: externalId,
  candidate_id: z.string().uuid(),
  action: z.enum(['shortlist', 'reject', 'on_hold', 'select']),
  reason: z.string().max(2000).optional(),
});

export const jobsInterviewRoundsWebhookSchema = z.object({
  external_id: externalId,
  op: z.enum(['create', 'update', 'cancel']),
  round_id: z.string().uuid().optional(),
  round: z
    .object({
      ...interviewRoundFields,
      mode: z.enum(['virtual', 'physical']).optional(),
      window_start: isoDateTime.optional(),
      window_end: isoDateTime.optional(),
      minutes_per_interview: z.number().int().positive().optional(),
    })
    .partial()
    .optional(),
  candidate_ids: z.array(z.string().uuid()).optional(),
});

export const jobsInterviewActionsWebhookSchema = z.object({
  round_id: z.string().uuid(),
  invite_id: z.string().uuid(),
  action: z.enum(['showed_up', 'start', 'no_show', 'outcome']),
  kind: z.enum(['no_show', 'not_joined']).optional(),
  outcome: z.enum(['selected', 'rejected', 'on_hold']).optional(),
});

export const jobsOffersWebhookSchema = z.object({
  external_id: externalId.optional(),
  offer_id: z.string().uuid().optional(),
  op: z.enum([
    'create',
    'update',
    'send',
    'mark_sent_manually',
    'accept_negotiation',
    'decline_negotiation',
    'counter',
    'withdraw',
    'answer_question',
  ]),
  candidate_ids: z.array(z.string().uuid()).optional(),
  all_selected: z.boolean().optional(),
  letter: z.record(z.unknown()).optional(),
  note: z.string().max(2000).optional(),
  answer: z.string().max(2000).optional(),
  ...offerPackageFields,
});

export const jobsQuestionAnswerWebhookSchema = z.object({
  question_id: z.string().uuid(),
  answer: z.string().min(1).max(4000),
});

export const jobsQuestionDeleteWebhookSchema = z.object({
  question_id: z.string().uuid(),
});

export const jobsHireWebhookSchema = z.object({
  external_id: externalId,
  candidate_id: z.string().uuid(),
  keep_open: z.boolean(),
  joining_date: isoDate,
});

export const jobsMarkJoinedWebhookSchema = z.object({
  external_id: externalId,
  candidate_id: z.string().uuid(),
});

export const jobsCloseWebhookSchema = z.object({
  external_id: externalId,
  close_mode: z.enum(['filled', 'cancelled']).default('cancelled'),
});

// Read-only: SquadHub pulls the live candidate funnel for a card. The proxy
// also sends source/actor — Zod strips those unknown keys by default.
export const jobsSnapshotWebhookSchema = z.object({
  external_id: externalId,
});

// ─── Types ─────────────────────────────────────────────────────────────────

export type JobPreferencesInput = z.infer<typeof jobPreferencesSchema>;
export type ListJobsQueryInput = z.infer<typeof listJobsQuerySchema>;
export type ReviewCandidateInput = z.infer<typeof reviewCandidateSchema>;
export type CreateInterviewRoundInput = z.infer<typeof createInterviewRoundSchema>;
export type UpdateInterviewRoundInput = z.infer<typeof updateInterviewRoundSchema>;
export type CreateOffersInput = z.infer<typeof createOffersSchema>;
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;
export type OfferRespondInput = z.infer<typeof offerRespondSchema>;
export type HireCandidateInput = z.infer<typeof hireCandidateSchema>;
export type BusinessLocationInput = z.infer<typeof businessLocationSchema>;
