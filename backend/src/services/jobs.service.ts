import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { emitJobsEvent } from './jobs-outbox.service.js';
import { createBusinessNotification } from './business-notifications.service.js';
import { notifyJobEvent } from './push.service.js';
import { fireJobsCrmEvent } from './talent-whatsapp.service.js';
import type {
  BusinessLocationInput,
  HireCandidateInput,
  JobPreferencesInput,
  ReviewCandidateInput,
} from '../validators/jobs.validators.js';

/**
 * Jobs module core — hiring funnel over the satellite tables (00101):
 * job_profiles / job_cards / job_candidates / job_candidate_events, riding
 * the shared subscription_cards + subscription_card_recipients pair.
 *
 * Every admin-capable mutation takes a JobsActor. actor.source==='squadhub'
 * marks an inbound admin-mirror webhook — the change is applied canonically
 * here but the echo outbox event is SUPPRESSED (SquadHub already knows).
 */

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

export interface JobsActor {
  type: 'talent' | 'business' | 'admin' | 'system';
  id?: string | null;
  /** Set on inbound SquadHub admin-mirror webhooks — suppresses the echo outbox event. */
  source?: 'squadhub';
}

export function shouldEmitOutbox(actor: JobsActor): boolean {
  return actor.source !== 'squadhub';
}

// ─── Small shared helpers ──────────────────────────────────────────────────

export function contentTitle(content: Record<string, unknown>): string {
  if (typeof content.title === 'string' && content.title.trim()) return content.title.trim();
  const jp = content.job_profile as Record<string, unknown> | undefined;
  if (jp && typeof jp.title === 'string' && jp.title.trim()) return jp.title.trim();
  return 'a job opening';
}

export function contentBusinessName(content: Record<string, unknown>): string {
  if (typeof content.brand_name === 'string' && content.brand_name.trim()) {
    return content.brand_name.trim();
  }
  const bp = content.business_profile as Record<string, unknown> | undefined;
  if (bp && typeof bp.name === 'string' && bp.name.trim()) return bp.name.trim();
  return 'the business';
}

export async function getTalentNames(talentUserIds: string[]): Promise<Map<string, string>> {
  const nameById = new Map<string, string>();
  const ids = [...new Set(talentUserIds)].filter(Boolean);
  if (ids.length === 0) return nameById;
  const { data } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name')
    .in('id', ids);
  for (const t of data ?? []) {
    const u = t as { id: string; full_name: string | null };
    nameById.set(u.id, u.full_name || 'Unknown talent');
  }
  return nameById;
}

/**
 * In-app talent notification: one `notifications` row (kind='system') fanned
 * to the given talents via notification_recipients — lands in the existing
 * /talent/notifications module. Never throws.
 */
export async function notifyTalentsInApp(
  talentUserIds: string[],
  systemType: string,
  title: string,
  body?: string | null,
): Promise<void> {
  const ids = [...new Set(talentUserIds)].filter(Boolean);
  if (ids.length === 0) return;
  try {
    const { data: notification, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        kind: 'system',
        system_type: systemType,
        title,
        body: body ?? null,
      })
      .select('id')
      .single();
    if (error || !notification) {
      console.error('[jobs] in-app notification insert failed', error?.message);
      return;
    }
    const { error: recErr } = await supabaseAdmin
      .from('notification_recipients')
      .insert(ids.map((tid) => ({ notification_id: notification.id, talent_user_id: tid })));
    if (recErr) {
      console.error('[jobs] in-app notification fan-out failed', recErr.message);
    }
  } catch (err) {
    console.error('[jobs] notifyTalentsInApp threw', err);
  }
}

// ─── Card references ───────────────────────────────────────────────────────

export interface JobCardRefs {
  cardId: string;
  externalId: string | null;
  businessUserId: string | null;
  content: Record<string, unknown>;
  jobProfileId: string;
  jobProfileExternalId: string | null;
  hiringStage: string;
  screeningStartedAt: string | null;
  closedAt: string | null;
  openings: number;
}

/**
 * Resolve everything the jobs services routinely need about one hiring card
 * (card row + job_cards satellite + job_profiles external id). 404s when the
 * card isn't a hiring card or has no satellite (never synced).
 */
export async function getCardRefs(cardId: string): Promise<JobCardRefs> {
  const { data: card, error: cardErr } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, external_id, business_user_id, content, card_type')
    .eq('id', cardId)
    .maybeSingle();
  if (cardErr) throw new AppError(500, cardErr.message);
  if (!card || (card as any).card_type !== 'hiring') {
    throw new AppError(404, 'Job card not found');
  }

  const { data: jobCard, error: jcErr } = await supabaseAdmin
    .from('job_cards')
    .select('card_id, job_profile_id, hiring_stage, screening_started_at, closed_at, openings, job_profiles(external_id)')
    .eq('card_id', cardId)
    .maybeSingle();
  if (jcErr) throw new AppError(500, jcErr.message);
  if (!jobCard) throw new AppError(404, 'Job card is missing its hiring satellite');

  return {
    cardId,
    externalId: ((card as any).external_id as string | null) ?? null,
    businessUserId: ((card as any).business_user_id as string | null) ?? null,
    content: ((card as any).content ?? {}) as Record<string, unknown>,
    jobProfileId: (jobCard as any).job_profile_id as string,
    jobProfileExternalId: ((jobCard as any).job_profiles?.external_id as string | null) ?? null,
    hiringStage: (jobCard as any).hiring_stage as string,
    screeningStartedAt: ((jobCard as any).screening_started_at as string | null) ?? null,
    closedAt: ((jobCard as any).closed_at as string | null) ?? null,
    openings: ((jobCard as any).openings as number) ?? 1,
  };
}

/** Resolve a SquadHub external card id to our subscription_cards.id (hiring only). */
export async function getCardIdByExternalId(externalId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, card_type')
    .eq('external_id', externalId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data || (data as any).card_type !== 'hiring') {
    throw new AppError(404, 'Job card not found for external_id');
  }
  return (data as any).id as string;
}

// ─── Candidate primitives ──────────────────────────────────────────────────

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

const CANDIDATE_FIELDS =
  'id, recipient_id, card_id, job_profile_id, talent_user_id, funnel_stage, stage_changed_at, rejected_reason, hired_at, keep_card_open, joining_date, joined_at, created_at';

export async function getCandidate(candidateId: string, cardId?: string): Promise<JobCandidateRow> {
  let q = supabaseAdmin.from('job_candidates').select(CANDIDATE_FIELDS).eq('id', candidateId);
  if (cardId) q = q.eq('card_id', cardId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Candidate not found');
  return data as unknown as JobCandidateRow;
}

/** Immutable audit row on job_candidate_events. Never throws. */
export async function logCandidateEvent(input: {
  candidateId: string;
  cardId: string;
  actor: JobsActor;
  eventType: string;
  fromStage?: string | null;
  toStage?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('job_candidate_events').insert({
    candidate_id: input.candidateId,
    card_id: input.cardId,
    actor_type: input.actor.type,
    actor_id: input.actor.id ?? null,
    event_type: input.eventType,
    from_stage: input.fromStage ?? null,
    to_stage: input.toStage ?? null,
    payload: input.payload ?? {},
  });
  if (error) {
    console.error('[jobs] failed to log candidate event', { eventType: input.eventType, error: error.message });
  }
}

/**
 * Move a candidate to a new funnel stage (+ optional extra columns) and log
 * the transition. Idempotent: a same-stage move returns the row untouched.
 */
export async function setCandidateStage(
  candidateId: string,
  toStage: JobFunnelStage,
  actor: JobsActor,
  opts: { extraPatch?: Record<string, unknown>; payload?: Record<string, unknown> } = {},
): Promise<JobCandidateRow> {
  const candidate = await getCandidate(candidateId);
  if (candidate.funnel_stage === toStage && !opts.extraPatch) return candidate;

  const patch: Record<string, unknown> = {
    funnel_stage: toStage,
    stage_changed_at: new Date().toISOString(),
    ...(opts.extraPatch ?? {}),
  };
  const { data: updated, error } = await supabaseAdmin
    .from('job_candidates')
    .update(patch)
    .eq('id', candidateId)
    .select(CANDIDATE_FIELDS)
    .single();
  if (error || !updated) throw new AppError(500, error?.message ?? 'Failed to update candidate');

  if (candidate.funnel_stage !== toStage) {
    await logCandidateEvent({
      candidateId,
      cardId: candidate.card_id,
      actor,
      eventType: 'stage_changed',
      fromStage: candidate.funnel_stage,
      toStage,
      payload: opts.payload ?? {},
    });
  }

  return updated as unknown as JobCandidateRow;
}

// ─── Talent: opt-in + preferences ──────────────────────────────────────────

const PREF_FIELDS =
  'talent_user_id, opted_in_at, opted_out_at, preferred_locations, preferred_countries, preferred_states, preferred_districts, preferred_cities, preferred_job_types, open_to_relocation, expected_salary_monthly, notice_period_days';

export async function getJobPreferences(talentUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('talent_job_preferences')
    .select(PREF_FIELDS)
    .eq('talent_user_id', talentUserId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) {
    return {
      opted_in: false,
      opted_in_at: null,
      opted_out_at: null,
      preferred_locations: [] as unknown[],
      preferred_countries: [] as string[],
      preferred_states: [] as string[],
      preferred_districts: [] as string[],
      preferred_cities: [] as string[],
      preferred_job_types: [] as string[],
      open_to_relocation: false,
      expected_salary_monthly: null,
      notice_period_days: null,
    };
  }
  return { opted_in: (data as any).opted_in_at != null, ...(data as any) };
}

export async function optInToJobs(talentUserId: string, prefs: JobPreferencesInput = {}) {
  const { error } = await supabaseAdmin.from('talent_job_preferences').upsert(
    {
      talent_user_id: talentUserId,
      opted_in_at: new Date().toISOString(),
      ...prefsPatch(prefs),
    },
    { onConflict: 'talent_user_id' },
  );
  if (error) throw new AppError(500, error.message);
  return getJobPreferences(talentUserId);
}

export async function optOutOfJobs(talentUserId: string) {
  const { error } = await supabaseAdmin.from('talent_job_preferences').upsert(
    {
      talent_user_id: talentUserId,
      opted_in_at: null,
      opted_out_at: new Date().toISOString(),
    },
    { onConflict: 'talent_user_id' },
  );
  if (error) throw new AppError(500, error.message);
  return getJobPreferences(talentUserId);
}

// Flatten the nested preferred-locations tree into the flat arrays the matcher
// (preferred_districts) and summaries read. Deduped, order preserved.
function deriveFlatLocations(locations: JobPreferencesInput['preferred_locations']) {
  const tree = locations ?? [];
  const uniq = (xs: string[]) => Array.from(new Set(xs.filter((x) => x && x.trim().length > 0)));
  return {
    preferred_countries: uniq(tree.map((c) => c.country)),
    preferred_states: uniq(tree.flatMap((c) => (c.states ?? []).map((s) => s.state))),
    preferred_districts: uniq(tree.flatMap((c) => (c.states ?? []).flatMap((s) => s.districts ?? []))),
    preferred_cities: uniq(tree.flatMap((c) => (c.states ?? []).flatMap((s) => s.cities ?? []))),
  };
}

function prefsPatch(prefs: JobPreferencesInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (prefs.preferred_locations !== undefined) {
    // Tree is the source of truth — persist it and derive the flat arrays,
    // ignoring any flat arrays sent alongside it.
    patch.preferred_locations = prefs.preferred_locations;
    Object.assign(patch, deriveFlatLocations(prefs.preferred_locations));
  } else {
    if (prefs.preferred_countries !== undefined) patch.preferred_countries = prefs.preferred_countries;
    if (prefs.preferred_states !== undefined) patch.preferred_states = prefs.preferred_states;
    if (prefs.preferred_districts !== undefined) patch.preferred_districts = prefs.preferred_districts;
    if (prefs.preferred_cities !== undefined) patch.preferred_cities = prefs.preferred_cities;
  }
  if (prefs.preferred_job_types !== undefined) patch.preferred_job_types = prefs.preferred_job_types;
  if (prefs.open_to_relocation !== undefined) patch.open_to_relocation = prefs.open_to_relocation;
  if (prefs.expected_salary_monthly !== undefined) patch.expected_salary_monthly = prefs.expected_salary_monthly;
  if (prefs.notice_period_days !== undefined) patch.notice_period_days = prefs.notice_period_days;
  return patch;
}

export async function updateJobPreferences(talentUserId: string, prefs: JobPreferencesInput) {
  const patch = prefsPatch(prefs);
  if (Object.keys(patch).length === 0) return getJobPreferences(talentUserId);
  const { error } = await supabaseAdmin.from('talent_job_preferences').upsert(
    { talent_user_id: talentUserId, ...patch },
    { onConflict: 'talent_user_id' },
  );
  if (error) throw new AppError(500, error.message);
  return getJobPreferences(talentUserId);
}

// ─── Talent: tabbed feed ───────────────────────────────────────────────────

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

const TAB_STAGES: Record<Exclude<TalentJobsTab, 'new' | 'rejected'>, JobFunnelStage[]> = {
  accepted: ['applied', 'screening'],
  shortlisted: ['shortlisted'],
  call_for_interview: ['interview_invited'],
  interview: ['interview', 'on_hold'],
  selected: ['selected'],
  offer: ['offer'],
  hired: ['hired'],
  placed: ['placed'],
};

export interface TalentJobFeedItem {
  recipient_id: string | null;
  candidate_id: string | null;
  funnel_stage: JobFunnelStage | 'declined' | null;
  stage_changed_at: string | null;
  job_profile_id: string | null;
  card: {
    id: string;
    external_id: string | null;
    content: Record<string, unknown>;
    status: string;
    published_at: string | null;
    expires_at: string | null;
  } | null;
}

export async function listJobsForTalent(
  talentUserId: string,
  tab: TalentJobsTab,
): Promise<TalentJobFeedItem[]> {
  if (tab === 'new') {
    const { data, error } = await supabaseAdmin
      .from('subscription_card_recipients')
      .select(
        'id, status, created_at, viewed_at, subscription_cards!inner(id, external_id, content, status, published_at, expires_at, archived_at, card_type)',
      )
      .eq('talent_user_id', talentUserId)
      .eq('status', 'pending')
      .is('cancelled_at', null)
      .eq('subscription_cards.card_type', 'hiring')
      .eq('subscription_cards.status', 'active')
      .is('subscription_cards.archived_at', null)
      .order('created_at', { ascending: false });
    if (error) throw new AppError(500, error.message);

    const rows = data ?? [];

    // Stamp viewed_at (releases the WhatsApp engagement throttle) — same
    // fire-and-forget the subscription feed does.
    const unviewedIds = rows.filter((r: any) => r.viewed_at == null).map((r: any) => r.id as string);
    if (unviewedIds.length > 0) {
      supabaseAdmin
        .from('subscription_card_recipients')
        .update({ viewed_at: new Date().toISOString() })
        .in('id', unviewedIds)
        .is('viewed_at', null)
        .then(({ error: updErr }) => {
          if (updErr) console.error('[jobs] viewed_at stamp failed', updErr);
        });
    }

    const profileByCard = await getJobProfileIdsForCards(
      rows.map((r: any) => r.subscription_cards?.id as string),
    );

    return rows.map((r: any) => ({
      recipient_id: r.id as string,
      candidate_id: null,
      funnel_stage: null,
      stage_changed_at: null,
      job_profile_id: profileByCard.get(r.subscription_cards?.id as string) ?? null,
      card: mapFeedCard(r.subscription_cards),
    }));
  }

  const items: TalentJobFeedItem[] = [];

  const stages: JobFunnelStage[] = tab === 'rejected' ? ['rejected'] : TAB_STAGES[tab];
  const { data, error } = await supabaseAdmin
    .from('job_candidates')
    .select(
      `${CANDIDATE_FIELDS}, subscription_cards!inner(id, external_id, content, status, published_at, expires_at, archived_at)`,
    )
    .eq('talent_user_id', talentUserId)
    .in('funnel_stage', stages)
    .is('subscription_cards.archived_at', null)
    .order('stage_changed_at', { ascending: false });
  if (error) throw new AppError(500, error.message);

  for (const r of (data ?? []) as any[]) {
    items.push({
      recipient_id: r.recipient_id as string,
      candidate_id: r.id as string,
      funnel_stage: r.funnel_stage as JobFunnelStage,
      stage_changed_at: r.stage_changed_at as string,
      job_profile_id: r.job_profile_id as string,
      card: mapFeedCard(r.subscription_cards),
    });
  }

  // The Rejected tab also shows cards the talent themselves declined (no
  // candidate row exists for a declined recipient).
  if (tab === 'rejected') {
    const { data: declined, error: declErr } = await supabaseAdmin
      .from('subscription_card_recipients')
      .select(
        'id, status, responded_at, subscription_cards!inner(id, external_id, content, status, published_at, expires_at, archived_at, card_type)',
      )
      .eq('talent_user_id', talentUserId)
      .eq('status', 'rejected')
      .eq('subscription_cards.card_type', 'hiring')
      .is('subscription_cards.archived_at', null)
      .order('responded_at', { ascending: false });
    if (declErr) throw new AppError(500, declErr.message);

    const seenCards = new Set(items.map((i) => i.card?.id));
    const declinedRows = (declined ?? []).filter((r: any) => !seenCards.has(r.subscription_cards?.id));
    const profileByCard = await getJobProfileIdsForCards(
      declinedRows.map((r: any) => r.subscription_cards?.id as string),
    );
    for (const r of declinedRows as any[]) {
      items.push({
        recipient_id: r.id as string,
        candidate_id: null,
        funnel_stage: 'declined',
        stage_changed_at: (r.responded_at as string) ?? null,
        job_profile_id: profileByCard.get(r.subscription_cards?.id as string) ?? null,
        card: mapFeedCard(r.subscription_cards),
      });
    }
  }

  return items;
}

function mapFeedCard(card: any): TalentJobFeedItem['card'] {
  if (!card) return null;
  return {
    id: card.id,
    external_id: card.external_id ?? null,
    content: (card.content ?? {}) as Record<string, unknown>,
    status: card.status,
    published_at: card.published_at ?? null,
    expires_at: card.expires_at ?? null,
  };
}

async function getJobProfileIdsForCards(cardIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = [...new Set(cardIds)].filter(Boolean);
  if (ids.length === 0) return map;
  const { data } = await supabaseAdmin
    .from('job_cards')
    .select('card_id, job_profile_id')
    .in('card_id', ids);
  for (const row of data ?? []) {
    map.set((row as any).card_id as string, (row as any).job_profile_id as string);
  }
  return map;
}

export async function getUnreadJobsCount(talentUserId: string): Promise<number> {
  // Mirrors the subscription unread-count filters, scoped to hiring cards.
  const { count, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, subscription_cards!inner(status, archived_at, card_type)', {
      count: 'exact',
      head: true,
    })
    .eq('talent_user_id', talentUserId)
    .eq('status', 'pending')
    .is('cancelled_at', null)
    .eq('subscription_cards.status', 'active')
    .eq('subscription_cards.card_type', 'hiring')
    .is('subscription_cards.archived_at', null);
  if (error) throw new AppError(500, error.message);
  return count ?? 0;
}

export async function getJobDetailForTalent(talentUserId: string, recipientId: string) {
  const { data: recipient, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select(
      'id, status, responded_at, cancelled_at, created_at, subscription_cards!inner(id, external_id, content, status, published_at, expires_at, archived_at, card_type)',
    )
    .eq('id', recipientId)
    .eq('talent_user_id', talentUserId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!recipient || (recipient as any).subscription_cards?.card_type !== 'hiring') {
    throw new AppError(404, 'Job not found');
  }

  const card = (recipient as any).subscription_cards;
  const [{ data: candidate }, profileByCard] = await Promise.all([
    supabaseAdmin
      .from('job_candidates')
      .select(CANDIDATE_FIELDS)
      .eq('recipient_id', recipientId)
      .maybeSingle(),
    getJobProfileIdsForCards([card.id as string]),
  ]);

  return {
    recipient: {
      id: (recipient as any).id,
      status: (recipient as any).status,
      responded_at: (recipient as any).responded_at,
      cancelled_at: (recipient as any).cancelled_at,
      created_at: (recipient as any).created_at,
    },
    candidate: candidate ?? null,
    job_profile_id: profileByCard.get(card.id as string) ?? null,
    card: mapFeedCard(card),
  };
}

// ─── Talent: job profile view (recipient-gated) ────────────────────────────

/**
 * A talent may view a job profile only if they were a recipient of at least
 * one card published against it — profiles are candidate-facing marketing,
 * not a public directory.
 */
export async function assertTalentCanViewJobProfile(
  talentUserId: string,
  jobProfileId: string,
): Promise<void> {
  const { data: cards, error } = await supabaseAdmin
    .from('job_cards')
    .select('card_id')
    .eq('job_profile_id', jobProfileId);
  if (error) throw new AppError(500, error.message);
  const cardIds = (cards ?? []).map((c: any) => c.card_id as string);
  if (cardIds.length === 0) throw new AppError(403, 'You do not have access to this job profile');

  const { data: recipient, error: recErr } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id')
    .eq('talent_user_id', talentUserId)
    .in('card_id', cardIds)
    .limit(1)
    .maybeSingle();
  if (recErr) throw new AppError(500, recErr.message);
  if (!recipient) throw new AppError(403, 'You do not have access to this job profile');
}

export async function getJobProfileViewForTalent(talentUserId: string, jobProfileId: string) {
  await assertTalentCanViewJobProfile(talentUserId, jobProfileId);
  const { data: profile, error } = await supabaseAdmin
    .from('job_profiles')
    .select('id, external_id, title, description, details, business_snapshot, brand_snapshot, status')
    .eq('id', jobProfileId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!profile) throw new AppError(404, 'Job profile not found');
  return profile;
}

// ─── Respond hooks (called from subscription.service.respond) ──────────────

/**
 * Talent ACCEPTED a hiring card → they become a job candidate ('applied').
 * Idempotent on the recipient's unique index. Never throws — the accept call
 * must not fail on funnel bookkeeping.
 */
export async function onHiringCardAccepted(params: {
  cardId: string;
  recipientId: string;
  talentUserId: string;
}): Promise<void> {
  try {
    const refs = await getCardRefs(params.cardId);

    const { data: inserted, error } = await supabaseAdmin
      .from('job_candidates')
      .insert({
        recipient_id: params.recipientId,
        card_id: params.cardId,
        job_profile_id: refs.jobProfileId,
        talent_user_id: params.talentUserId,
        funnel_stage: 'applied',
      })
      .select('id')
      .single();
    if (error) {
      // 23505 = candidate already exists (webhook replay / double tap) — done.
      if (error.code !== '23505') {
        console.error('[jobs] failed to insert job candidate on accept', error.message);
      }
      return;
    }

    const actor: JobsActor = { type: 'talent', id: params.talentUserId };
    await logCandidateEvent({
      candidateId: inserted.id as string,
      cardId: params.cardId,
      actor,
      eventType: 'stage_changed',
      fromStage: null,
      toStage: 'applied',
    });

    const names = await getTalentNames([params.talentUserId]);
    const talentName = names.get(params.talentUserId) ?? 'A talent';
    const title = contentTitle(refs.content);

    await emitJobsEvent(
      'job_candidate_applied',
      {
        external_id: refs.externalId,
        job_profile_external_id: refs.jobProfileExternalId,
        recipient_id: params.recipientId,
        candidate_id: inserted.id as string,
        actor,
        data: { talent_user_id: params.talentUserId, talent_name: talentName },
      },
      `job_candidate_applied:${params.recipientId}`,
    );

    if (refs.businessUserId) {
      await createBusinessNotification({
        businessUserId: refs.businessUserId,
        type: 'job_candidate_applied',
        title: `${talentName} applied for ${title}`,
        ref: { card_id: params.cardId, candidate_id: inserted.id, route: 'jobs' },
      });
    }
  } catch (err) {
    console.error('[jobs] onHiringCardAccepted threw', err);
  }
}

/** Talent DECLINED a hiring card → business in-app note only. Never throws. */
export async function onHiringCardDeclined(params: {
  cardId: string;
  recipientId: string;
  talentUserId: string;
}): Promise<void> {
  try {
    const refs = await getCardRefs(params.cardId);
    if (!refs.businessUserId) return;
    const names = await getTalentNames([params.talentUserId]);
    await createBusinessNotification({
      businessUserId: refs.businessUserId,
      type: 'job_candidate_declined',
      title: `${names.get(params.talentUserId) ?? 'A talent'} declined ${contentTitle(refs.content)}`,
      ref: { card_id: params.cardId, recipient_id: params.recipientId, route: 'jobs' },
    });
  } catch (err) {
    console.error('[jobs] onHiringCardDeclined threw', err);
  }
}

// ─── Business: cards + candidates ──────────────────────────────────────────

/**
 * Ownership guard for the /api/business/jobs surface. Resolves by
 * business_user_id with the same business_email fallback the subscription
 * dashboard uses (the card can arrive before the business_users row).
 */
export async function assertBusinessOwnsCard(
  businessUserId: string,
  cardId: string,
): Promise<JobCardRefs> {
  const refs = await getCardRefs(cardId);
  if (refs.businessUserId === businessUserId) return refs;

  // Email fallback: card not yet linked to a business_users row.
  if (!refs.businessUserId) {
    const [{ data: businessUser }, { data: card }] = await Promise.all([
      supabaseAdmin.from('business_users').select('contact_email').eq('id', businessUserId).maybeSingle(),
      supabaseAdmin.from('subscription_cards').select('business_email').eq('id', cardId).maybeSingle(),
    ]);
    const contactEmail = (businessUser as any)?.contact_email as string | null | undefined;
    const cardEmail = (card as any)?.business_email as string | null | undefined;
    if (contactEmail && cardEmail && contactEmail.toLowerCase() === cardEmail.toLowerCase()) {
      return refs;
    }
  }
  throw new AppError(403, 'This job card does not belong to your business');
}

export async function listJobCardsForBusiness(businessUserId: string) {
  const { data: businessUser } = await supabaseAdmin
    .from('business_users')
    .select('contact_email')
    .eq('id', businessUserId)
    .maybeSingle();
  const contactEmail = ((businessUser as any)?.contact_email as string | null | undefined) ?? null;

  const orFilter = contactEmail
    ? `business_user_id.eq.${businessUserId},and(business_user_id.is.null,business_email.ilike.${contactEmail})`
    : `business_user_id.eq.${businessUserId}`;

  const { data: cards, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, external_id, content, status, published_at, expires_at, created_at')
    .or(orFilter)
    .eq('card_type', 'hiring')
    .is('archived_at', null)
    .order('published_at', { ascending: false });
  if (error) throw new AppError(500, error.message);

  const list = cards ?? [];
  if (list.length === 0) return [];
  const cardIds = list.map((c: any) => c.id as string);

  const [{ data: jobCards }, { data: candidateRows }, { data: recipientRows }] = await Promise.all([
    supabaseAdmin
      .from('job_cards')
      .select('card_id, job_profile_id, hiring_stage, screening_started_at, closed_at, close_mode, openings')
      .in('card_id', cardIds),
    supabaseAdmin.from('job_candidates').select('card_id, funnel_stage').in('card_id', cardIds),
    supabaseAdmin
      .from('subscription_card_recipients')
      .select('card_id, status, cancelled_at')
      .in('card_id', cardIds),
  ]);

  const jobCardByCard = new Map<string, any>();
  for (const jc of jobCards ?? []) jobCardByCard.set((jc as any).card_id as string, jc);

  const countsByCard = new Map<string, Record<string, number>>();
  for (const c of candidateRows ?? []) {
    const bucket = countsByCard.get((c as any).card_id) ?? {};
    const stage = (c as any).funnel_stage as string;
    bucket[stage] = (bucket[stage] ?? 0) + 1;
    countsByCard.set((c as any).card_id, bucket);
  }

  const pendingByCard = new Map<string, number>();
  for (const r of recipientRows ?? []) {
    if ((r as any).status === 'pending' && (r as any).cancelled_at == null) {
      pendingByCard.set((r as any).card_id, (pendingByCard.get((r as any).card_id) ?? 0) + 1);
    }
  }

  return list.map((c: any) => ({
    id: c.id,
    external_id: c.external_id ?? null,
    content: (c.content ?? {}) as Record<string, unknown>,
    status: c.status,
    published_at: c.published_at,
    expires_at: c.expires_at,
    job_card: jobCardByCard.get(c.id) ?? null,
    funnel_counts: countsByCard.get(c.id) ?? {},
    pending_recipients: pendingByCard.get(c.id) ?? 0,
  }));
}

export async function getJobCardForBusiness(businessUserId: string, cardId: string) {
  const refs = await assertBusinessOwnsCard(businessUserId, cardId);

  const [{ data: card }, { data: jobCard }, { data: candidateRows }] = await Promise.all([
    supabaseAdmin
      .from('subscription_cards')
      .select('id, external_id, content, status, published_at, expires_at')
      .eq('id', cardId)
      .single(),
    supabaseAdmin
      .from('job_cards')
      .select('card_id, job_profile_id, hiring_stage, screening_started_at, closed_at, close_mode, openings')
      .eq('card_id', cardId)
      .single(),
    supabaseAdmin.from('job_candidates').select('funnel_stage').eq('card_id', cardId),
  ]);

  const funnelCounts: Record<string, number> = {};
  for (const c of candidateRows ?? []) {
    const stage = (c as any).funnel_stage as string;
    funnelCounts[stage] = (funnelCounts[stage] ?? 0) + 1;
  }

  const { data: profile } = await supabaseAdmin
    .from('job_profiles')
    .select('id, external_id, title, description, details, business_snapshot, brand_snapshot, status')
    .eq('id', refs.jobProfileId)
    .maybeSingle();

  return { card, job_card: jobCard, job_profile: profile ?? null, funnel_counts: funnelCounts };
}

export async function listCandidates(cardId: string, stage?: JobFunnelStage) {
  let q = supabaseAdmin
    .from('job_candidates')
    .select(CANDIDATE_FIELDS)
    .eq('card_id', cardId)
    .order('stage_changed_at', { ascending: false });
  if (stage) q = q.eq('funnel_stage', stage);
  const { data, error } = await q;
  if (error) throw new AppError(500, error.message);

  const rows = data ?? [];
  const names = await getTalentNames(rows.map((r: any) => r.talent_user_id as string));
  return rows.map((r: any) => ({
    ...r,
    talent_name: names.get(r.talent_user_id) ?? null,
  }));
}

// ─── Funnel actions ────────────────────────────────────────────────────────

export async function startScreening(cardId: string, actor: JobsActor) {
  const refs = await getCardRefs(cardId);
  if (refs.closedAt) throw new AppError(409, 'This job card is closed');

  if (refs.screeningStartedAt) {
    return { screening_started_at: refs.screeningStartedAt, moved: 0, already_started: true };
  }

  const startedAt = new Date().toISOString();
  const { error: updErr } = await supabaseAdmin
    .from('job_cards')
    .update({ hiring_stage: 'screening', screening_started_at: startedAt })
    .eq('card_id', cardId)
    .is('screening_started_at', null);
  if (updErr) throw new AppError(500, updErr.message);

  // Move every applied candidate into screening.
  const { data: applied, error: candErr } = await supabaseAdmin
    .from('job_candidates')
    .select('id, talent_user_id')
    .eq('card_id', cardId)
    .eq('funnel_stage', 'applied');
  if (candErr) throw new AppError(500, candErr.message);

  const appliedRows = applied ?? [];
  if (appliedRows.length > 0) {
    const { error: moveErr } = await supabaseAdmin
      .from('job_candidates')
      .update({ funnel_stage: 'screening', stage_changed_at: startedAt })
      .eq('card_id', cardId)
      .eq('funnel_stage', 'applied');
    if (moveErr) throw new AppError(500, moveErr.message);

    const { error: evErr } = await supabaseAdmin.from('job_candidate_events').insert(
      appliedRows.map((c: any) => ({
        candidate_id: c.id,
        card_id: cardId,
        actor_type: actor.type,
        actor_id: actor.id ?? null,
        event_type: 'stage_changed',
        from_stage: 'applied',
        to_stage: 'screening',
        payload: {},
      })),
    );
    if (evErr) console.error('[jobs] failed to log screening events', evErr.message);
  }

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent(
      'job_screening_started',
      {
        external_id: refs.externalId,
        job_profile_external_id: refs.jobProfileExternalId,
        actor,
        data: { screening_started_at: startedAt, moved: appliedRows.length },
      },
      `job_screening_started:${cardId}`,
    );
  }

  return { screening_started_at: startedAt, moved: appliedRows.length, already_started: false };
}

const REVIEW_STAGE: Record<ReviewCandidateInput['action'], JobFunnelStage> = {
  shortlist: 'shortlisted',
  reject: 'rejected',
  on_hold: 'on_hold',
  select: 'selected',
};

export async function reviewCandidate(
  cardId: string,
  candidateId: string,
  input: ReviewCandidateInput,
  actor: JobsActor,
) {
  const refs = await getCardRefs(cardId);
  const candidate = await getCandidate(candidateId, cardId);
  const toStage = REVIEW_STAGE[input.action];

  const extraPatch: Record<string, unknown> = {};
  if (input.action === 'reject' && input.reason) extraPatch.rejected_reason = input.reason;

  const updated = await setCandidateStage(candidateId, toStage, actor, {
    extraPatch: Object.keys(extraPatch).length > 0 ? extraPatch : undefined,
    payload: { action: input.action, reason: input.reason ?? null },
  });

  // Mirror shortlist/reject onto the shared recipient row —
  // business_review_status feeds the SquadHub recipients funnel view.
  if (input.action === 'shortlist' || input.action === 'reject') {
    const { error: mirrorErr } = await supabaseAdmin
      .from('subscription_card_recipients')
      .update({
        business_review_status: input.action === 'shortlist' ? 'shortlisted' : 'rejected',
        business_reviewed_at: new Date().toISOString(),
      })
      .eq('id', candidate.recipient_id);
    if (mirrorErr) {
      console.error('[jobs] failed to mirror business_review_status', mirrorErr.message);
    }
  }

  // Talent notifications (matrix: shortlisted→T+push; outcome/rejection→T+push).
  const title = contentTitle(refs.content);
  const businessName = contentBusinessName(refs.content);
  const names = await getTalentNames([candidate.talent_user_id]);
  const talentName = names.get(candidate.talent_user_id) ?? '';
  const copy: Record<ReviewCandidateInput['action'], { title: string; body: string }> = {
    shortlist: {
      title: "You've been shortlisted!",
      body: `You were shortlisted for ${title} at ${businessName}.`,
    },
    reject: {
      title: 'Application update',
      body: `Your application for ${title} at ${businessName} was not taken forward.`,
    },
    on_hold: {
      title: 'Application on hold',
      body: `Your application for ${title} at ${businessName} is on hold — we'll keep you posted.`,
    },
    select: {
      title: "You've been selected!",
      body: `Congratulations! You were selected for ${title} at ${businessName}.`,
    },
  };
  notifyTalentsInApp([candidate.talent_user_id], `job_${toStage}`, copy[input.action].title, copy[input.action].body).catch(() => {});
  notifyJobEvent([candidate.talent_user_id], {
    type: 'job_stage',
    title: copy[input.action].title,
    body: copy[input.action].body,
    cardId,
  }).catch((err) => console.error('[jobs] review push threw', err));
  if (input.action === 'reject') {
    fireJobsCrmEvent('talent_job_rejected', candidate.talent_user_id, {
      talent_name: talentName,
      job_title: title,
      business_name: businessName,
    }).catch((err) => console.error('[jobs] rejected WA threw', err));
  }

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent('job_candidate_reviewed', {
      external_id: refs.externalId,
      job_profile_external_id: refs.jobProfileExternalId,
      recipient_id: candidate.recipient_id,
      candidate_id: candidateId,
      actor,
      data: {
        action: input.action,
        from_stage: candidate.funnel_stage,
        to_stage: toStage,
        reason: input.reason ?? null,
      },
    });
  }

  return updated;
}

export async function hireCandidate(
  cardId: string,
  candidateId: string,
  input: HireCandidateInput,
  actor: JobsActor,
) {
  const refs = await getCardRefs(cardId);
  const candidate = await getCandidate(candidateId, cardId);

  // Hire is for offer-accepted candidates only.
  const { data: acceptedOffer, error: offerErr } = await supabaseAdmin
    .from('job_offers')
    .select('id, position_title')
    .eq('candidate_id', candidateId)
    .eq('status', 'accepted')
    .maybeSingle();
  if (offerErr) throw new AppError(500, offerErr.message);
  if (!acceptedOffer) {
    throw new AppError(409, 'Candidate must have an accepted offer before they can be hired');
  }

  const hiredAt = new Date().toISOString();
  const updated = await setCandidateStage(candidateId, 'hired', actor, {
    extraPatch: {
      hired_at: hiredAt,
      keep_card_open: input.keep_open,
      joining_date: input.joining_date,
    },
    payload: { keep_open: input.keep_open, joining_date: input.joining_date },
  });

  const title = ((acceptedOffer as any).position_title as string) || contentTitle(refs.content);
  const businessName = contentBusinessName(refs.content);
  const names = await getTalentNames([candidate.talent_user_id]);

  notifyTalentsInApp(
    [candidate.talent_user_id],
    'job_hired',
    "You're hired!",
    `Congratulations! ${businessName} hired you as ${title}. Joining date: ${input.joining_date}.`,
  ).catch(() => {});
  notifyJobEvent([candidate.talent_user_id], {
    type: 'job_hired',
    title: "You're hired!",
    body: `Congratulations! ${businessName} hired you as ${title}.`,
    cardId,
  }).catch((err) => console.error('[jobs] hired push threw', err));
  fireJobsCrmEvent(
    'talent_job_hired',
    candidate.talent_user_id,
    {
      talent_name: names.get(candidate.talent_user_id) ?? '',
      position_title: title,
      business_name: businessName,
      joining_date: input.joining_date,
    },
    { bypass: true },
  ).catch((err) => console.error('[jobs] hired WA threw', err));

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent(
      'job_candidate_hired',
      {
        external_id: refs.externalId,
        job_profile_external_id: refs.jobProfileExternalId,
        recipient_id: candidate.recipient_id,
        candidate_id: candidateId,
        actor,
        data: { keep_open: input.keep_open, joining_date: input.joining_date, offer_id: acceptedOffer.id },
      },
      `job_candidate_hired:${candidateId}`,
    );
  }

  let closed = false;
  if (!input.keep_open) {
    await closeJobCard(cardId, 'filled', actor);
    closed = true;
  }

  const hiredCount = await countCandidatesInStages(cardId, ['hired', 'placed']);
  return {
    candidate: updated,
    closed,
    remaining_openings: Math.max(refs.openings - hiredCount, 0),
  };
}

async function countCandidatesInStages(cardId: string, stages: JobFunnelStage[]): Promise<number> {
  const { count } = await supabaseAdmin
    .from('job_candidates')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', cardId)
    .in('funnel_stage', stages);
  return count ?? 0;
}

/**
 * Close a job card ('filled' after a hire, 'cancelled' otherwise). Withdraws
 * every un-accepted offer and notifies those candidates — the position is no
 * longer on the table.
 */
export async function closeJobCard(
  cardId: string,
  closeMode: 'filled' | 'cancelled',
  actor: JobsActor,
) {
  const refs = await getCardRefs(cardId);
  if (refs.closedAt) return { closed_at: refs.closedAt, withdrawn_offers: 0, already_closed: true };

  const closedAt = new Date().toISOString();
  const { error: updErr } = await supabaseAdmin
    .from('job_cards')
    .update({ hiring_stage: 'closed', closed_at: closedAt, close_mode: closeMode })
    .eq('card_id', cardId)
    .is('closed_at', null);
  if (updErr) throw new AppError(500, updErr.message);

  // Withdraw offers that are still live but not accepted.
  const { data: liveOffers, error: offersErr } = await supabaseAdmin
    .from('job_offers')
    .select('id, talent_user_id, candidate_id, status')
    .eq('card_id', cardId)
    .in('status', ['draft', 'sent', 'negotiating', 'countered']);
  if (offersErr) throw new AppError(500, offersErr.message);

  const offers = liveOffers ?? [];
  if (offers.length > 0) {
    const { error: wErr } = await supabaseAdmin
      .from('job_offers')
      .update({ status: 'withdrawn', withdrawn_at: closedAt })
      .in('id', offers.map((o: any) => o.id as string));
    if (wErr) throw new AppError(500, wErr.message);

    const { error: evErr } = await supabaseAdmin.from('offer_events').insert(
      offers.map((o: any) => ({
        offer_id: o.id,
        actor_type: actor.type,
        actor_id: actor.id ?? null,
        action: 'withdrawn',
        note: 'Card closed',
      })),
    );
    if (evErr) console.error('[jobs] failed to log offer withdrawals on close', evErr.message);

    // Notify the remaining offered candidates (sent+ only — a never-sent
    // draft was invisible to the talent).
    const notifyIds = offers
      .filter((o: any) => o.status !== 'draft')
      .map((o: any) => o.talent_user_id as string);
    if (notifyIds.length > 0) {
      const title = contentTitle(refs.content);
      const businessName = contentBusinessName(refs.content);
      notifyTalentsInApp(
        notifyIds,
        'job_card_closed',
        'Position closed',
        `The ${title} position at ${businessName} has been closed and your offer was withdrawn.`,
      ).catch(() => {});
      notifyJobEvent(notifyIds, {
        type: 'job_offer',
        title: 'Position closed',
        body: `The ${title} position at ${businessName} has been closed.`,
        cardId,
      }).catch((err) => console.error('[jobs] close push threw', err));
      const names = await getTalentNames(notifyIds);
      for (const tid of notifyIds) {
        fireJobsCrmEvent('talent_job_card_closed', tid, {
          talent_name: names.get(tid) ?? '',
          job_title: title,
          business_name: businessName,
        }).catch((err) => console.error('[jobs] close WA threw', err));
      }
    }
  }

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent(
      'job_card_closed',
      {
        external_id: refs.externalId,
        job_profile_external_id: refs.jobProfileExternalId,
        actor,
        data: { close_mode: closeMode, withdrawn_offers: offers.length },
      },
      `job_card_closed:${cardId}`,
    );
  }

  return { closed_at: closedAt, withdrawn_offers: offers.length, already_closed: false };
}

export async function markJoined(cardId: string, candidateId: string, actor: JobsActor) {
  const refs = await getCardRefs(cardId);
  const candidate = await getCandidate(candidateId, cardId);
  if (candidate.funnel_stage !== 'hired' && candidate.funnel_stage !== 'placed') {
    throw new AppError(409, 'Only a hired candidate can be marked as joined');
  }
  if (candidate.funnel_stage === 'placed') {
    return candidate;
  }

  const joinedAt = new Date().toISOString();
  const updated = await setCandidateStage(candidateId, 'placed', actor, {
    extraPatch: { joined_at: joinedAt },
  });

  const title = contentTitle(refs.content);
  const businessName = contentBusinessName(refs.content);
  notifyTalentsInApp(
    [candidate.talent_user_id],
    'job_placed',
    'Welcome aboard!',
    `${businessName} marked you as joined for ${title}. All the best!`,
  ).catch(() => {});
  notifyJobEvent([candidate.talent_user_id], {
    type: 'job_stage',
    title: 'Welcome aboard!',
    body: `${businessName} marked you as joined for ${title}.`,
    cardId,
  }).catch((err) => console.error('[jobs] joined push threw', err));

  // matrix: joined → T + B. Skip the business copy when the business itself
  // clicked the button.
  if (actor.type !== 'business' && refs.businessUserId) {
    const names = await getTalentNames([candidate.talent_user_id]);
    await createBusinessNotification({
      businessUserId: refs.businessUserId,
      type: 'job_candidate_joined',
      title: `${names.get(candidate.talent_user_id) ?? 'Your hire'} joined for ${title}`,
      ref: { card_id: cardId, candidate_id: candidateId, route: 'jobs' },
    });
  }

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent(
      'job_candidate_joined',
      {
        external_id: refs.externalId,
        job_profile_external_id: refs.jobProfileExternalId,
        recipient_id: candidate.recipient_id,
        candidate_id: candidateId,
        actor,
        data: { joined_at: joinedAt },
      },
      `job_candidate_joined:${candidateId}`,
    );
  }

  return updated;
}

// ─── Business locations (saved interview venues) ───────────────────────────

export async function listBusinessLocations(businessUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('business_locations')
    .select('id, label, address, maps_url, is_active, created_at')
    .eq('business_user_id', businessUserId)
    .eq('is_active', true)
    .order('label', { ascending: true });
  if (error) throw new AppError(500, error.message);
  return data ?? [];
}

export async function createBusinessLocation(businessUserId: string, input: BusinessLocationInput) {
  const { data, error } = await supabaseAdmin
    .from('business_locations')
    .insert({
      business_user_id: businessUserId,
      label: input.label,
      address: input.address,
      maps_url: input.maps_url ?? null,
    })
    .select('id, label, address, maps_url, is_active, created_at')
    .single();
  if (error) throw new AppError(500, error.message);
  return data;
}

export async function updateBusinessLocation(
  businessUserId: string,
  locationId: string,
  input: BusinessLocationInput,
) {
  const { data, error } = await supabaseAdmin
    .from('business_locations')
    .update({ label: input.label, address: input.address, maps_url: input.maps_url ?? null })
    .eq('id', locationId)
    .eq('business_user_id', businessUserId)
    .select('id, label, address, maps_url, is_active, created_at')
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Location not found');
  return data;
}

export async function deleteBusinessLocation(businessUserId: string, locationId: string) {
  // Soft-delete — interview_rounds.location_id references the row and the
  // frozen location_snapshot on past rounds must keep rendering.
  const { data, error } = await supabaseAdmin
    .from('business_locations')
    .update({ is_active: false })
    .eq('id', locationId)
    .eq('business_user_id', businessUserId)
    .select('id')
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Location not found');
  return { deleted: true };
}
