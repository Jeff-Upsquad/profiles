import crypto from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { findMatchingTalents } from './subscription-matcher.service.js';
import { deliverCallback } from './squadhub-callback.service.js';
import { notifyNewCard, notifySelected } from './push.service.js';
import { getTalentTiersByUserIds } from './talent-tier.service.js';
import type {
  IngestSubscriptionCardInput,
  ListSubscriptionsQueryInput,
  ManualAssignTalentInput,
  RemoveAssignedTalentInput,
  RespondToSubscriptionInput,
} from '../validators/subscription.validators.js';

// Sentinel UUID used as `assigned_by` / `shared_by` for rows that the
// subscription pipeline writes automatically (no human admin in the loop).
// The two columns are NOT NULL but have no FK, so a fixed UUID is fine.
const SYSTEM_ACTOR_UUID = '00000000-0000-0000-0000-000000000000';

function extractCategoryIds(matchRules: unknown): string[] {
  if (!matchRules || typeof matchRules !== 'object') return [];
  const raw = (matchRules as Record<string, unknown>).category_ids;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function normalizePhone(phone: string | undefined): string {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
}

/**
 * Resolve a business_users row by email first, then by normalized phone.
 * Either is enough — used by the card ingest path.
 */
async function resolveBusinessUserIdFromEmailOrPhone(
  email: string | undefined,
  phone: string | undefined,
): Promise<string | null> {
  if (email) {
    const { data, error } = await supabaseAdmin
      .from('business_users')
      .select('id')
      .ilike('contact_email', email)
      .eq('is_active', true)
      .maybeSingle();
    if (error) {
      console.error('[subscription] business_user email lookup failed', { email, error: error.message });
    } else if (data) {
      return data.id as string;
    }
  }

  const phoneNormalized = normalizePhone(phone);
  if (phoneNormalized.length >= 6) {
    const { data, error } = await supabaseAdmin
      .from('business_users')
      .select('id')
      .eq('contact_phone_normalized', phoneNormalized)
      .eq('is_active', true)
      .maybeSingle();
    if (error) {
      console.error('[subscription] business_user phone lookup failed', { phone: phoneNormalized, error: error.message });
    } else if (data) {
      return data.id as string;
    }
  }

  if (email || phone) {
    console.warn('[subscription] no business_user matched email or phone', { email, phone });
  }
  return null;
}

/**
 * On card ingest, when no existing business_user matches the lead's email
 * or phone, drop a 7-day pending invitation so the customer can sign in
 * once they accept it. Idempotent: a pending invitation for the same email
 * (or phone) is left alone.
 */
async function createBusinessInvitationIfNew(input: {
  email?: string;
  phone?: string;
  contactName?: string;
  company?: string;
}): Promise<void> {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  if (!email && !phone) return;

  const phoneNormalized = normalizePhone(phone || undefined);

  // Skip if a pending invitation already exists for this email or phone.
  // The schema has unique partial indexes on both, so a duplicate insert
  // would 23505 anyway — checking up front keeps the log clean.
  if (email) {
    const { data } = await supabaseAdmin
      .from('invitations')
      .select('id')
      .eq('status', 'pending')
      .ilike('email', email)
      .maybeSingle();
    if (data) return;
  }
  if (!email && phoneNormalized && phoneNormalized.length >= 6) {
    const { data } = await supabaseAdmin
      .from('invitations')
      .select('id')
      .eq('status', 'pending')
      .eq('phone_normalized', phoneNormalized)
      .maybeSingle();
    if (data) return;
  }

  // 7-day expiry from now.
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Create the invitations row.
  const { data: invitation, error: invErr } = await supabaseAdmin
    .from('invitations')
    .insert({
      email: email ?? '',
      phone: phone,
      role: 'business',
      status: 'pending',
      company_name: input.company || null,
      contact_person_name: input.contactName || null,
      expires_at: expiresAt,
      invited_by: SYSTEM_ACTOR_UUID,
    })
    .select('id')
    .single();
  if (invErr || !invitation) {
    console.error('[subscription] failed to create business invitation', {
      email, phone, error: invErr?.message,
    });
    return;
  }

  // 2. Create the business_users row immediately so the customer can sign in
  //    by email or phone (mirrors the existing admin-side invite flow in
  //    invite.service.ts — businessLogin queries business_users, not the
  //    invitations table). access_expires_at = same 7-day window.
  const { error: bizErr } = await supabaseAdmin
    .from('business_users')
    .insert({
      id: crypto.randomUUID(),
      company_name: input.company || 'Unnamed Company',
      contact_person_name: input.contactName || '',
      contact_email: (email ?? '').toLowerCase(),
      contact_phone: phone,
      access_expires_at: expiresAt,
      invitation_id: invitation.id,
      is_active: true,
      verified: true,
    });
  if (bizErr) {
    // Roll back the invitation so a future ingest can try again instead of
    // sitting on a half-created state.
    await supabaseAdmin.from('invitations').delete().eq('id', invitation.id);
    console.error('[subscription] failed to create business_user; invitation rolled back', {
      email, phone, error: bizErr.message,
    });
    return;
  }
  console.info('[subscription] auto-created business_user + 7-day invitation', { email, phone });
}

async function autoSubscribeBusinessToCategories(
  businessUserId: string,
  categoryIds: string[]
): Promise<void> {
  if (categoryIds.length === 0) return;

  const rows = categoryIds.map((category_id) => ({
    business_user_id: businessUserId,
    category_id,
    assigned_by: SYSTEM_ACTOR_UUID,
  }));

  const { error } = await supabaseAdmin
    .from('business_category_subscriptions')
    .upsert(rows, { onConflict: 'business_user_id,category_id', ignoreDuplicates: true });

  if (error) {
    console.error('[subscription] failed to auto-subscribe business to categories', {
      businessUserId,
      categoryIds,
      error: error.message,
    });
  }
}

/**
 * On talent accept: insert one business_shared_profiles row per matching
 * (talent_profile, category) so the talent appears in the business dashboard.
 * Idempotent via UNIQUE(business_user_id, talent_profile_id). Never throws —
 * dashboard writes shouldn't fail the user-facing accept call.
 */
async function writeAcceptedTalentToDashboard(
  businessUserId: string,
  talentUserId: string,
  matchRules: unknown
): Promise<void> {
  const categoryIds = extractCategoryIds(matchRules);
  if (categoryIds.length === 0) return;

  const { data: profiles, error: profErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('id, category_id')
    .eq('talent_user_id', talentUserId)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .in('category_id', categoryIds);

  if (profErr) {
    console.error('[subscription] failed to load talent profiles for dashboard write', {
      talentUserId,
      error: profErr.message,
    });
    return;
  }

  if (!profiles || profiles.length === 0) {
    console.debug('[subscription] no approved talent profile in card categories', {
      talentUserId,
      categoryIds,
    });
    return;
  }

  const rows = profiles.map((p: any) => ({
    business_user_id: businessUserId,
    talent_profile_id: p.id as string,
    category_id: p.category_id as string,
    shared_by: SYSTEM_ACTOR_UUID,
  }));

  const { error } = await supabaseAdmin
    .from('business_shared_profiles')
    .upsert(rows, { onConflict: 'business_user_id,talent_profile_id', ignoreDuplicates: true });

  if (error) {
    console.error('[subscription] failed to write to business_shared_profiles', {
      businessUserId,
      talentUserId,
      error: error.message,
    });
  }
}

// ─── Ingest (webhook from SquadHub) ────────────────────────────────────────

export interface IngestResult {
  id: string;
  external_id: string;
  inserted: boolean;
  recipient_count: number;
}

export async function ingestCard(input: IngestSubscriptionCardInput): Promise<IngestResult> {
  // Resolve the lead to a Profiles business_users row by email or phone.
  // If neither matches, fire-and-forget a 7-day pending invitation so the
  // customer can sign in later (and a future ingest will then resolve them).
  const businessUserId = await resolveBusinessUserIdFromEmailOrPhone(
    input.business_email,
    input.business_phone,
  );
  if (!businessUserId) {
    createBusinessInvitationIfNew({
      email: input.business_email,
      phone: input.business_phone,
      contactName: input.business_contact_name,
      company: input.business_company,
    }).catch((err) => {
      console.error('[subscription] business invitation create threw', err);
    });
  }

  // Manual ("soft publish") cards must NOT auto-fan-out. The business owner
  // sees them via business_email → business_user_id resolution; talents see
  // them only when a separate /manual-assignments call hand-picks them.
  const skipAutoFanOut = input.distribution === 'manual';

  const row = {
    external_id: input.external_id,
    content: input.content,
    match_rules: input.match_rules,
    published_at: input.published_at ?? new Date().toISOString(),
    expires_at: input.expires_at ?? null,
    business_user_id: businessUserId,
    // Stored verbatim so the business dashboard can fall back to email-match
    // when business_user_id is null (the lead's business_users row may be
    // created AFTER the card arrives — they accept their invitation later).
    business_email: input.business_email ?? null,
    distribution: input.distribution,
    // recalled_at: SquadHub stamps this when an admin recalls a card that
    // had acceptances. Always written so a recall can also be cleared by
    // sending null on a re-publish.
    recalled_at: input.recalled_at ?? null,
    // archived_at: SquadHub stamps this on explicit Archive (and clears
    // it on Republish). Filtered out of every talent and business-facing
    // query so the card disappears entirely. Always written so the
    // null-on-republish transition takes effect.
    archived_at: input.archived_at ?? null,
    // is_secondary: SquadHub flags child cards. Written on every ingest so
    // a card that flips primary↔secondary can't get stuck on the wrong side.
    is_secondary: input.is_secondary,
    // status: write only when SquadHub sent one. On insert we still default
    // to 'active' via the column default; on update we preserve the existing
    // status when `status` is omitted so a plain content refresh doesn't
    // accidentally un-archive a recalled card.
    ...(input.status ? { status: input.status } : {}),
  };

  // Upsert the card by external_id for idempotency.
  const { data: existing } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, status')
    .eq('external_id', input.external_id)
    .maybeSingle();

  if (existing?.id) {
    const previousStatus = (existing as any).status as 'active' | 'assigned' | 'archived';
    const nextStatus = input.status ?? previousStatus;
    const isRecall = (previousStatus === 'active' || previousStatus === 'assigned') && nextStatus === 'archived';
    const isRepublish = previousStatus === 'archived' && nextStatus === 'active';

    const updatePatch: Record<string, unknown> = {
      content: row.content,
      match_rules: row.match_rules,
      published_at: row.published_at,
      expires_at: row.expires_at,
      // Re-resolve on every ingest so SquadHub can correct the link by
      // re-publishing with a fixed business_email. Null overwrites a stale id.
      business_user_id: businessUserId,
      business_email: row.business_email,
      distribution: row.distribution,
      recalled_at: row.recalled_at,
      archived_at: row.archived_at,
      is_secondary: row.is_secondary,
    };
    if (input.status) updatePatch.status = input.status;

    const { error } = await supabaseAdmin
      .from('subscription_cards')
      .update(updatePatch)
      .eq('id', existing.id);
    if (error) throw new AppError(500, error.message);

    if (businessUserId) {
      await autoSubscribeBusinessToCategories(businessUserId, extractCategoryIds(input.match_rules));
    }

    // Recall: stamp cancelled_at on every still-active recipient row. Old
    // status (pending/accepted/rejected) is preserved as audit; the row stays
    // visible to the talent with a "Cancelled" tag.
    if (isRecall) {
      const { error: cancelErr } = await supabaseAdmin
        .from('subscription_card_recipients')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('card_id', existing.id)
        .is('cancelled_at', null);
      if (cancelErr) {
        console.error('[subscription] failed to mark recipients cancelled on recall', cancelErr);
      }
    }

    // Republish (archived → active) or plain edit while active: re-fan-out
    // to every matching talent that doesn't already have an *active* (uncancelled)
    // row. The partial unique index `WHERE cancelled_at IS NULL` can't be
    // inferred by PostgREST's ON CONFLICT, so we read existing active rows,
    // diff against the matched talents, and INSERT only the missing ones.
    // Cancelled rows from prior rounds stay around as audit.
    //
    // Manual cards are exempt: they only ever surface to talents through
    // /manual-assignments, never auto-fan-out, even on republish.
    let recipientCount = 0;
    if (nextStatus === 'active' && !skipAutoFanOut) {
      const talentIds = await findMatchingTalents(input.match_rules ?? {});
      if (talentIds.length > 0) {
        const { data: existingRows, error: existErr } = await supabaseAdmin
          .from('subscription_card_recipients')
          .select('talent_user_id')
          .eq('card_id', existing.id)
          .is('cancelled_at', null);

        if (existErr) {
          console.error('[subscription] failed to read existing recipients', existErr);
        } else {
          const haveActive = new Set(
            (existingRows ?? []).map((r: any) => r.talent_user_id as string)
          );
          const newTalentIds = talentIds.filter((id) => !haveActive.has(id));

          if (newTalentIds.length > 0) {
            const recipients = newTalentIds.map((talent_user_id) => ({
              card_id: existing.id,
              talent_user_id,
              status: 'pending' as const,
            }));
            const { error: recErr, count } = await supabaseAdmin
              .from('subscription_card_recipients')
              .insert(recipients, { count: 'exact' });
            if (recErr) {
              // 23505 = unique violation. A concurrent webhook can race us
              // between the SELECT and INSERT; the partial index will reject
              // the duplicate, which is the correct outcome — log and move on.
              if (recErr.code !== '23505') {
                console.error('[subscription] failed to insert recipients on update', recErr);
              }
            } else {
              recipientCount = count ?? newTalentIds.length;
              notifyNewCard(existing.id, newTalentIds, input.content ?? {}).catch((err) => {
                console.error('[subscription] notifyNewCard (update) threw', err);
              });
            }
          }
        }
      }
    }

    if (isRepublish) {
      console.info('[subscription] republished card', {
        external_id: input.external_id,
        new_recipients: recipientCount,
      });
    }

    return {
      id: existing.id,
      external_id: input.external_id,
      inserted: false,
      recipient_count: recipientCount,
    };
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('subscription_cards')
    .insert(row)
    .select('id')
    .single();
  if (insErr || !inserted) throw new AppError(500, insErr?.message ?? 'Failed to insert card');

  if (businessUserId) {
    await autoSubscribeBusinessToCategories(businessUserId, extractCategoryIds(input.match_rules));
  }

  // Fan out: find matching talents and batch-insert recipient rows.
  // Manual ("soft publish") cards skip this — they only reach talents
  // via the explicit /manual-assignments hand-pick path.
  const talentIds = skipAutoFanOut
    ? []
    : await findMatchingTalents(input.match_rules ?? {});

  let recipientCount = 0;
  if (talentIds.length > 0) {
    const recipients = talentIds.map((talent_user_id) => ({
      card_id: inserted.id,
      talent_user_id,
      status: 'pending' as const,
    }));

    const { error: recErr, count } = await supabaseAdmin
      .from('subscription_card_recipients')
      .insert(recipients, { count: 'exact' });
    if (recErr) {
      console.error('[subscription] failed to insert recipients', recErr);
      // Don't fail the whole ingest — the card exists and the next retry/manual
      // fix can backfill. Log loudly and move on.
    } else {
      recipientCount = count ?? recipients.length;
      notifyNewCard(inserted.id, talentIds, input.content ?? {}).catch((err) => {
        console.error('[subscription] notifyNewCard threw', err);
      });
    }
  }

  return {
    id: inserted.id,
    external_id: input.external_id,
    inserted: true,
    recipient_count: recipientCount,
  };
}

// ─── Talent-facing queries ─────────────────────────────────────────────────

interface RecipientRow {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  responded_at: string | null;
  cancelled_at: string | null;
  selected_at: string | null;
  passed_over_at: string | null;
  created_at: string;
  subscription_cards: {
    id: string;
    external_id: string;
    content: Record<string, unknown>;
    status: 'active' | 'assigned' | 'archived';
    published_at: string;
    expires_at: string | null;
  } | null;
}

export async function listForTalent(
  talentUserId: string,
  query: ListSubscriptionsQueryInput
): Promise<Array<{
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  responded_at: string | null;
  cancelled_at: string | null;
  selected_at: string | null;
  passed_over_at: string | null;
  card: RecipientRow['subscription_cards'];
}>> {
  // Cancelled-but-pending rows are hidden everywhere — the talent never
  // responded, so there's nothing to keep showing them. Cancelled-but-
  // responded rows stay in the Responded tab, annotated with a Cancelled
  // tag, so the talent can still see what happened to a card they engaged
  // with. cancelled_at is the signal: it's stamped by the ingest handler
  // when SquadHub sends status='archived' (recall, close, or cancel-
  // subscription on the lead).
  let q = supabaseAdmin
    .from('subscription_card_recipients')
    .select(
      'id, status, responded_at, cancelled_at, selected_at, passed_over_at, created_at, subscription_cards!inner(id, external_id, content, status, published_at, expires_at, archived_at)'
    )
    .eq('talent_user_id', talentUserId)
    // Hard-archived cards (SquadHub Archive tab) disappear from every
    // talent view, including the Responded tab — the spec requires them
    // to be invisible everywhere, not just demoted. Filter at the joined
    // card so even responded-row history stops surfacing the card.
    .is('subscription_cards.archived_at', null)
    .order('created_at', { ascending: false });

  if (query.status === 'pending') {
    // Pending tab shows only live offers. An archived card (recalled, closed,
    // or cancelled-subscription) must never surface here, even if a stale
    // recipient row escaped the recall's cancelled_at stamp — e.g. a manual
    // assignment that fired after the recall and predated the guard.
    q = q
      .eq('status', 'pending')
      .is('cancelled_at', null)
      .eq('subscription_cards.status', 'active');
  } else if (query.status === 'responded') {
    q = q.in('status', ['accepted', 'rejected']);
  } else {
    // 'all' — show responded (cancelled or not) and active-pending; hide
    // cancelled-pending for the same reason as above.
    q = q.or('status.in.(accepted,rejected),cancelled_at.is.null');
  }

  const { data, error } = await q;
  if (error) throw new AppError(500, error.message);

  return (data ?? []).map((r: any) => ({
    id: r.id,
    status: r.status,
    responded_at: r.responded_at,
    cancelled_at: r.cancelled_at,
    selected_at: r.selected_at ?? null,
    passed_over_at: r.passed_over_at ?? null,
    card: r.subscription_cards,
  }));
}

export async function getUnreadCount(talentUserId: string): Promise<number> {
  // Cancelled offers don't count as unread — the partner rescinded them.
  // Archived cards likewise don't count, even if a stale recipient row
  // exists (must mirror the pending-tab filter in listForTalent).
  const { count, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, subscription_cards!inner(status, archived_at)', { count: 'exact', head: true })
    .eq('talent_user_id', talentUserId)
    .eq('status', 'pending')
    .is('cancelled_at', null)
    .eq('subscription_cards.status', 'active')
    // Mirror listForTalent: hard-archived cards never count as unread.
    .is('subscription_cards.archived_at', null);

  if (error) throw new AppError(500, error.message);
  return count ?? 0;
}

// ─── Admin-facing queries ──────────────────────────────────────────────────

export interface AdminCardRow {
  id: string;
  external_id: string | null;
  status: 'active' | 'archived';
  distribution: 'broadcast' | 'manual';
  published_at: string;
  expires_at: string | null;
  business_name: string | null;
  subscription_name: string | null;
  plan_label: string | null;
  content: Record<string, unknown>;
  match_rules: Record<string, unknown>;
  source: string;
  subscription_request_id: number | null;
  talents: { pending: number; accepted: number; rejected: number; shortlisted_by_business: number; rejected_by_business: number };
  selected_talent_user_id: string | null;
}

export interface AdminListCardsInput {
  status?: 'active' | 'assigned' | 'archived';
  distribution?: 'broadcast' | 'manual';
  search?: string;
  business_review_filter?: 'has_shortlisted' | 'has_business_rejected' | 'has_selected';
}

export async function listAllForAdmin(input: AdminListCardsInput): Promise<AdminCardRow[]> {
  let q = supabaseAdmin
    .from('subscription_cards')
    .select('id, external_id, status, distribution, published_at, expires_at, content, match_rules, source, subscription_request_id, selected_talent_user_id')
    .order('published_at', { ascending: false });

  if (input.status === 'active' || input.status === 'assigned' || input.status === 'archived') {
    q = q.eq('status', input.status);
  }

  if (input.distribution === 'broadcast' || input.distribution === 'manual') {
    q = q.eq('distribution', input.distribution);
  }

  const { data: cards, error } = await q;
  if (error) throw new AppError(500, error.message);

  let list = cards ?? [];

  if (input.search?.trim()) {
    const needle = input.search.trim().toLowerCase();
    list = list.filter((c: any) => {
      const content = (c.content ?? {}) as Record<string, unknown>;
      const business = String(content.brand_name ?? '').toLowerCase();
      const sub = String(content.subscription_name ?? '').toLowerCase();
      return business.includes(needle) || sub.includes(needle);
    });
  }

  if (list.length === 0) return [];

  const cardIds = list.map((c: any) => c.id);

  // Batch-fetch recipient statuses for all cards in one query, then bucket
  // them by card_id. Avoids N+1 round-trips.
  const { data: recipientRows, error: recErr } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('card_id, status, business_review_status')
    .in('card_id', cardIds);
  if (recErr) throw new AppError(500, recErr.message);

  const countsByCard = new Map<string, { pending: number; accepted: number; rejected: number; shortlisted_by_business: number; rejected_by_business: number }>();
  for (const id of cardIds) {
    countsByCard.set(id, { pending: 0, accepted: 0, rejected: 0, shortlisted_by_business: 0, rejected_by_business: 0 });
  }
  for (const r of recipientRows ?? []) {
    const bucket = countsByCard.get((r as any).card_id);
    if (!bucket) continue;
    const status = (r as any).status as string;
    if (status === 'accepted') bucket.accepted++;
    else if (status === 'pending') bucket.pending++;
    else if (status === 'rejected') bucket.rejected++;

    const bizReview = (r as any).business_review_status as string | null;
    if (status === 'accepted' && bizReview === 'shortlisted') bucket.shortlisted_by_business++;
    if (status === 'accepted' && bizReview === 'rejected') bucket.rejected_by_business++;
  }

  let result: AdminCardRow[] = list.map((c: any) => {
    const content = (c.content ?? {}) as Record<string, unknown>;
    const match_rules = (c.match_rules ?? {}) as Record<string, unknown>;
    return {
      id: c.id,
      external_id: c.external_id ?? null,
      status: c.status,
      distribution: (c.distribution as 'broadcast' | 'manual') ?? 'broadcast',
      published_at: c.published_at,
      expires_at: c.expires_at,
      business_name: (content.brand_name as string) ?? null,
      subscription_name: (content.subscription_name as string) ?? null,
      plan_label: (content.plan_name as string) ?? null,
      content,
      match_rules,
      source: c.source ?? 'webhook',
      subscription_request_id: c.subscription_request_id ?? null,
      talents: countsByCard.get(c.id) ?? { pending: 0, accepted: 0, rejected: 0, shortlisted_by_business: 0, rejected_by_business: 0 },
      selected_talent_user_id: c.selected_talent_user_id ?? null,
    };
  });

  if (input.business_review_filter) {
    result = result.filter((card) => {
      if (input.business_review_filter === 'has_shortlisted') return card.talents.shortlisted_by_business > 0;
      if (input.business_review_filter === 'has_business_rejected') return card.talents.rejected_by_business > 0;
      if (input.business_review_filter === 'has_selected') return card.selected_talent_user_id != null;
      return true;
    });
  }

  return result;
}

export async function getCardForAdmin(cardId: string): Promise<AdminCardRow> {
  const { data: c, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, external_id, status, distribution, published_at, expires_at, content, match_rules, source, subscription_request_id, selected_talent_user_id')
    .eq('id', cardId)
    .single();
  if (error) throw new AppError(error.code === 'PGRST116' ? 404 : 500, error.message);

  const content = ((c as any).content ?? {}) as Record<string, unknown>;
  const match_rules = ((c as any).match_rules ?? {}) as Record<string, unknown>;
  return {
    id: (c as any).id,
    external_id: (c as any).external_id ?? null,
    status: (c as any).status,
    distribution: ((c as any).distribution as 'broadcast' | 'manual') ?? 'broadcast',
    published_at: (c as any).published_at,
    expires_at: (c as any).expires_at,
    business_name: (content.brand_name as string) ?? null,
    subscription_name: (content.subscription_name as string) ?? null,
    plan_label: (content.plan_name as string) ?? null,
    content,
    match_rules,
    source: (c as any).source ?? 'webhook',
    subscription_request_id: (c as any).subscription_request_id ?? null,
    talents: { pending: 0, accepted: 0, rejected: 0, shortlisted_by_business: 0, rejected_by_business: 0 },
    selected_talent_user_id: (c as any).selected_talent_user_id ?? null,
  };
}

export interface AdminCardRecipient {
  id: string;
  talent_user_id: string;
  talent_name: string | null;
  tier: 'junior' | 'pro' | 'elite' | 'custom' | null;
  tier_custom: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  responded_at: string | null;
  selected_at: string | null;
  passed_over_at: string | null;
  business_review_status: 'shortlisted' | 'rejected' | null;
  business_reviewed_at: string | null;
  created_at: string;
}

export async function listRecipientsForAdmin(cardId: string): Promise<AdminCardRecipient[]> {
  const { data, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, talent_user_id, status, responded_at, selected_at, passed_over_at, business_review_status, business_reviewed_at, created_at')
    .eq('card_id', cardId)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const talentIds = Array.from(new Set(rows.map((r: any) => r.talent_user_id))).filter(Boolean);
  const { data: talents } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name')
    .in('id', talentIds.length ? talentIds : ['00000000-0000-0000-0000-000000000000']);

  const nameById = new Map<string, string>();
  for (const t of talents ?? []) {
    const u = t as any;
    nameById.set(u.id, u.full_name || u.id.slice(0, 8));
  }

  const tiers = await getTalentTiersByUserIds(talentIds as string[]);

  return rows.map((r: any) => ({
    id: r.id,
    talent_user_id: r.talent_user_id,
    talent_name: nameById.get(r.talent_user_id) ?? null,
    tier: tiers[r.talent_user_id]?.tier ?? null,
    tier_custom: tiers[r.talent_user_id]?.tier_custom ?? null,
    status: r.status,
    responded_at: r.responded_at,
    selected_at: r.selected_at ?? null,
    passed_over_at: r.passed_over_at ?? null,
    business_review_status: r.business_review_status ?? null,
    business_reviewed_at: r.business_reviewed_at ?? null,
    created_at: r.created_at,
  }));
}

/**
 * List all talent recipients for a card identified by its SquadHub external_id.
 * Used by the cross-service webhook so SquadHub can display the full broadcast
 * audience (including talents who haven't responded yet).
 */
export async function listRecipientsByExternalId(externalId: string) {
  // Resolve external_id → internal card id
  const { data: card, error: cardErr } = await supabaseAdmin
    .from('subscription_cards')
    .select('id')
    .eq('external_id', externalId)
    .maybeSingle();
  if (cardErr) throw new AppError(500, cardErr.message);
  if (!card) throw new AppError(404, 'Card not found');

  const { data, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, talent_user_id, status, responded_at, cancelled_at, selected_at, passed_over_at, created_at')
    .eq('card_id', card.id)
    .is('cancelled_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const talentIds = Array.from(new Set(rows.map((r: any) => r.talent_user_id))).filter(Boolean);
  const idQuery = talentIds.length ? talentIds : ['00000000-0000-0000-0000-000000000000'];

  // Fetch profile names from talent_users and registration emails from auth.users
  // in parallel. Email goes back to SquadHub so it can resolve each talent to a
  // matching SquadHub user (used for the auto-accept-talent flow).
  const [
    { data: talents },
    { data: authRows, error: authErr },
  ] = await Promise.all([
    supabaseAdmin
      .from('talent_users')
      .select('id, full_name')
      .in('id', idQuery),
    talentIds.length
      ? supabaseAdmin.rpc('get_auth_users_by_ids', { id_list: talentIds })
      : Promise.resolve({ data: [] as { id: string; email: string }[], error: null }),
  ]);
  if (authErr) {
    // Email is best-effort — log and continue. The recipients list is still
    // useful without it; SquadHub's auto-accept simply won't be available
    // for those rows.
    console.error('[listRecipientsByExternalId] auth users lookup failed:', authErr.message);
  }

  const nameById = new Map<string, string>();
  for (const t of talents ?? []) {
    const u = t as any;
    nameById.set(u.id, u.full_name || 'Unknown talent');
  }

  const emailById = new Map<string, string>();
  for (const r of (authRows ?? []) as { id: string; email: string }[]) {
    if (r.id && r.email) emailById.set(r.id, r.email);
  }

  return rows.map((r: any) => ({
    talent_user_id: r.talent_user_id,
    talent_name: nameById.get(r.talent_user_id) ?? 'Unknown talent',
    email: emailById.get(r.talent_user_id) ?? null,
    status: r.status,
    responded_at: r.responded_at,
    created_at: r.created_at,
  }));
}

// ─── Talent response ───────────────────────────────────────────────────────

export async function respond(
  talentUserId: string,
  recipientId: string,
  input: RespondToSubscriptionInput
) {
  const newStatus = input.action === 'accept' ? 'accepted' : 'rejected';
  const respondedAt = new Date().toISOString();

  // The `status = 'pending'` + `cancelled_at IS NULL` guards prevent both
  // double-response races and accepting/rejecting an offer the partner has
  // since recalled. RLS enforces the same rules; this guard is defense in
  // depth for the service-role write.
  const { data: updated, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .update({ status: newStatus, responded_at: respondedAt })
    .eq('id', recipientId)
    .eq('talent_user_id', talentUserId)
    .eq('status', 'pending')
    .is('cancelled_at', null)
    .select('id, talent_user_id, subscription_cards!inner(external_id, business_user_id, match_rules)')
    .maybeSingle();

  if (error) throw new AppError(500, error.message);
  if (!updated) {
    // Either not found (or not owned), already responded, or cancelled.
    // Distinguish so the UI can show the right message.
    const { data: existing } = await supabaseAdmin
      .from('subscription_card_recipients')
      .select('id, status, cancelled_at')
      .eq('id', recipientId)
      .eq('talent_user_id', talentUserId)
      .maybeSingle();
    if (!existing) throw new AppError(404, 'Subscription not found');
    if ((existing as any).cancelled_at) {
      throw new AppError(409, 'This offer has been cancelled by the partner');
    }
    throw new AppError(409, 'Already responded to this subscription');
  }

  const card = (updated as any).subscription_cards as {
    external_id?: string;
    business_user_id?: string | null;
    match_rules?: unknown;
  } | undefined;
  const externalId = card?.external_id;

  // On accept, surface the talent in the linked business's dashboard.
  // Fire-and-forget: a failure here must not block or fail the user response.
  if (input.action === 'accept' && card?.business_user_id) {
    try {
      await writeAcceptedTalentToDashboard(card.business_user_id, updated.talent_user_id, card.match_rules);
    } catch (err) {
      console.error('[subscription] writeAcceptedTalentToDashboard threw', err);
    }
  }

  // Fire-and-forget callback. Never block or fail the user's response on this.
  if (externalId) {
    const { data: talent } = await supabaseAdmin
      .from('talent_users')
      .select('full_name')
      .eq('id', updated.talent_user_id)
      .maybeSingle();

    deliverCallback({
      external_id: externalId,
      recipient_id: updated.id,
      talent_user_id: updated.talent_user_id,
      talent_name: talent?.full_name ?? undefined,
      action: input.action,
      responded_at: respondedAt,
    }).catch((err) => {
      console.error('[subscription] deliverCallback threw unexpectedly', err);
    });
  }

  return {
    id: updated.id,
    status: newStatus,
    responded_at: respondedAt,
  };
}

// ─── Talent acceptance via SquadHub webhook ──────────────────────────────
//
// SquadHub admins can auto-accept a card on a talent's behalf
// (`/admin/subscription-cards/:id/auto-accept-talent`). We mirror that
// here so SquadHire's recipient row matches and the linked business
// dashboard surfaces the talent — same side effects as a real `respond`,
// minus the deliverCallback (SquadHub is the source, no need to round-trip
// back to it).

export interface TalentAcceptedWebhookResult {
  updated: number;
  alreadyAccepted: boolean;
}

export async function handleTalentAcceptedByWebhook(
  externalId: string,
  talentUserId: string,
  acceptedAt?: string,
): Promise<TalentAcceptedWebhookResult> {
  const { data: card, error: cardErr } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, business_user_id, match_rules')
    .eq('external_id', externalId)
    .maybeSingle();
  if (cardErr) throw new AppError(500, cardErr.message);
  if (!card) throw new AppError(404, 'Card not found');

  const { data: existing, error: readErr } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, status, cancelled_at')
    .eq('card_id', (card as any).id)
    .eq('talent_user_id', talentUserId)
    .maybeSingle();
  if (readErr) throw new AppError(500, readErr.message);
  if (!existing) {
    throw new AppError(404, 'Talent is not a recipient on this card');
  }
  if ((existing as any).cancelled_at) {
    throw new AppError(409, 'Recipient row was cancelled');
  }
  if (existing.status === 'rejected') {
    throw new AppError(409, 'Talent has already rejected this card');
  }
  if (existing.status === 'accepted') {
    return { updated: 0, alreadyAccepted: true };
  }

  const respondedAt = acceptedAt ?? new Date().toISOString();
  // Status guard ensures a concurrent reject between read and update
  // surfaces as a 409 here rather than clobbering the rejection.
  const { data: updated, error: updErr } = await supabaseAdmin
    .from('subscription_card_recipients')
    .update({ status: 'accepted', responded_at: respondedAt })
    .eq('id', existing.id)
    .eq('status', 'pending')
    .is('cancelled_at', null)
    .select('id, talent_user_id')
    .maybeSingle();
  if (updErr) throw new AppError(500, updErr.message);
  if (!updated) {
    throw new AppError(
      409,
      'Recipient status changed before acceptance could complete — refresh and retry',
    );
  }

  const businessUserId = (card as any).business_user_id as string | null;
  if (businessUserId) {
    try {
      await writeAcceptedTalentToDashboard(
        businessUserId,
        (updated as any).talent_user_id,
        (card as any).match_rules,
      );
    } catch (err) {
      console.error('[handleTalentAcceptedByWebhook] writeAcceptedTalentToDashboard threw', err);
    }
  }

  return { updated: 1, alreadyAccepted: false };
}

// ─── Removal from business dashboard ───────────────────────────────────────

export interface RemoveFromBusinessDashboardResult {
  removed: number;
}

/**
 * Remove a previously-shared talent from the linked business's dashboard.
 * Deletes only the `business_shared_profiles` rows; the recipient row (and
 * its 'accepted' status) is preserved as the audit trail.
 *
 * Looks up the card by `external_id` so both the SquadHub webhook and the
 * Profiles admin UI can call this with the same payload shape.
 */
export async function removeFromBusinessDashboard(
  externalId: string,
  talentUserId: string
): Promise<RemoveFromBusinessDashboardResult> {
  const { data: card, error: cardErr } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, business_user_id, match_rules')
    .eq('external_id', externalId)
    .maybeSingle();

  if (cardErr) throw new AppError(500, cardErr.message);
  if (!card) throw new AppError(404, 'Subscription card not found');

  const businessUserId = (card as any).business_user_id as string | null;
  if (!businessUserId) {
    return { removed: 0 };
  }

  const categoryIds = extractCategoryIds((card as any).match_rules);
  if (categoryIds.length === 0) {
    return { removed: 0 };
  }

  const { data: profiles, error: profErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('id')
    .eq('talent_user_id', talentUserId)
    .in('category_id', categoryIds);

  if (profErr) throw new AppError(500, profErr.message);
  const profileIds = (profiles ?? []).map((p: any) => p.id as string);
  if (profileIds.length === 0) {
    return { removed: 0 };
  }

  const { error: delErr, count } = await supabaseAdmin
    .from('business_shared_profiles')
    .delete({ count: 'exact' })
    .eq('business_user_id', businessUserId)
    .in('talent_profile_id', profileIds);

  if (delErr) throw new AppError(500, delErr.message);

  return { removed: count ?? 0 };
}

/**
 * Admin variant: looks up the talent_user_id from the recipient row, then
 * delegates. Used by the Profiles admin UI which has cardId + recipientId
 * but not the external_id directly.
 */
export async function removeFromBusinessDashboardByRecipient(
  cardId: string,
  recipientId: string
): Promise<RemoveFromBusinessDashboardResult> {
  const { data: rec, error: recErr } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('talent_user_id, subscription_cards!inner(external_id)')
    .eq('id', recipientId)
    .eq('card_id', cardId)
    .maybeSingle();

  if (recErr) throw new AppError(500, recErr.message);
  if (!rec) throw new AppError(404, 'Recipient not found');

  const externalId = (rec as any).subscription_cards?.external_id as string | undefined;
  if (!externalId) throw new AppError(500, 'Recipient is missing card external_id');

  return removeFromBusinessDashboard(externalId, (rec as any).talent_user_id);
}

// ─── Manual assignments from SquadHub ──────────────────────────────────────

export interface ManualAssignTalentResult {
  card_id: string;
  talent_user_id: string;
  inserted: boolean;
}

/**
 * SquadHub admin hand-picked a talent for a soft-published card. Upsert a
 * recipient row so the card surfaces in the talent's subscription tab — same
 * shape as auto-fan-out, just driven by an admin instead of `match_rules`.
 *
 * Idempotent on (card_id, talent_user_id). 404s if the card or talent is
 * unknown so SquadHub-side admins get a clean error to act on (instead of a
 * silent no-op).
 */
export async function manualAssignTalent(
  input: ManualAssignTalentInput
): Promise<ManualAssignTalentResult> {
  const { data: card, error: cardErr } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, content, status')
    .eq('external_id', input.card_id)
    .maybeSingle();
  if (cardErr) throw new AppError(500, cardErr.message);
  if (!card) throw new AppError(404, 'Subscription card not found on Profiles');
  // Archived cards have been recalled/closed/cancelled. Creating a fresh
  // pending recipient row would surface the offer to the talent as if it
  // were live, bypassing the cancelled_at stamp the recall path applied.
  if ((card as any).status === 'archived') {
    throw new AppError(409, 'Cannot assign talent to an archived subscription card');
  }

  const { data: talent, error: talentErr } = await supabaseAdmin
    .from('talent_users')
    .select('id')
    .eq('id', input.talent_id)
    .maybeSingle();
  if (talentErr) throw new AppError(500, talentErr.message);
  if (!talent) throw new AppError(404, 'Talent not found');

  // Only an *active* (uncancelled) row counts as "already assigned". A
  // cancelled row from an earlier recall cycle should not block a fresh
  // assignment — otherwise re-assigning a talent after a recall+republish
  // is a silent no-op and the talent never sees the new offer. The partial
  // unique index `WHERE cancelled_at IS NULL` lets the new row coexist with
  // the cancelled audit row without conflict.
  const { data: existing } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id')
    .eq('card_id', (card as any).id)
    .eq('talent_user_id', input.talent_id)
    .is('cancelled_at', null)
    .maybeSingle();

  if (existing) {
    return {
      card_id: (card as any).id as string,
      talent_user_id: input.talent_id,
      inserted: false,
    };
  }

  const { error: insErr } = await supabaseAdmin
    .from('subscription_card_recipients')
    .insert({
      card_id: (card as any).id,
      talent_user_id: input.talent_id,
      status: 'pending',
    });
  if (insErr) throw new AppError(500, insErr.message);

  notifyNewCard((card as any).id, [input.talent_id], (card as any).content ?? {}).catch((err) => {
    console.error('[subscription] notifyNewCard (manual) threw', err);
  });

  return {
    card_id: (card as any).id as string,
    talent_user_id: input.talent_id,
    inserted: true,
  };
}

export interface RemoveAssignedTalentResult {
  card_id: string | null;
  talent_user_id: string;
  removed: number;
}

/**
 * SquadHub admin removed a previously-assigned talent from a card. Drops the
 * recipient row so the card disappears from the talent's subscription tab.
 *
 * Idempotent: returns `removed: 0` if the recipient (or the card itself) is
 * already gone — common after a Recall on the SquadHub side, which clears
 * recipients server-side and may fire removals for the same talents.
 */
export async function removeAssignedTalent(
  input: RemoveAssignedTalentInput
): Promise<RemoveAssignedTalentResult> {
  const { data: card } = await supabaseAdmin
    .from('subscription_cards')
    .select('id')
    .eq('external_id', input.card_id)
    .maybeSingle();
  if (!card) {
    return { card_id: null, talent_user_id: input.talent_id, removed: 0 };
  }

  const { error, count } = await supabaseAdmin
    .from('subscription_card_recipients')
    .delete({ count: 'exact' })
    .eq('card_id', (card as any).id)
    .eq('talent_user_id', input.talent_id);
  if (error) throw new AppError(500, error.message);

  return {
    card_id: (card as any).id as string,
    talent_user_id: input.talent_id,
    removed: count ?? 0,
  };
}

// ─── Admin selection ─────────────────────────────────────────────────────

export interface SelectRecipientResult {
  card_id: string;
  selected_talent_user_id: string;
}

export async function adminSelectRecipient(
  cardId: string,
  recipientId: string,
): Promise<SelectRecipientResult> {
  const { data: card, error: cardErr } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, external_id, status, selected_at, content')
    .eq('id', cardId)
    .maybeSingle();
  if (cardErr) throw new AppError(500, cardErr.message);
  if (!card) throw new AppError(404, 'Card not found');
  if ((card as any).status !== 'active') throw new AppError(409, 'Card must be active');
  if ((card as any).selected_at) throw new AppError(409, 'A recipient has already been selected');

  const { data: recipient } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, talent_user_id, status')
    .eq('id', recipientId)
    .eq('card_id', cardId)
    .maybeSingle();
  if (!recipient) throw new AppError(404, 'Recipient not found');
  if ((recipient as any).status !== 'accepted') {
    throw new AppError(400, 'Recipient must have accepted before they can be selected');
  }

  const now = new Date().toISOString();
  const talentUserId = (recipient as any).talent_user_id as string;

  // Stamp selected
  await supabaseAdmin
    .from('subscription_card_recipients')
    .update({ selected_at: now })
    .eq('id', recipientId);

  // Pass over others
  await supabaseAdmin
    .from('subscription_card_recipients')
    .update({ passed_over_at: now })
    .eq('card_id', cardId)
    .eq('status', 'accepted')
    .neq('id', recipientId)
    .is('passed_over_at', null);

  // Mark card
  await supabaseAdmin
    .from('subscription_cards')
    .update({ selected_talent_user_id: talentUserId, selected_at: now })
    .eq('id', cardId);

  notifySelected(cardId, talentUserId, (card as any).content ?? {}).catch((err) => {
    console.error('[subscription] notifySelected threw', err);
  });

  // Fire callback to SquadHub
  const externalId = (card as any).external_id as string | undefined;
  if (externalId) {
    const { data: talent } = await supabaseAdmin
      .from('talent_users')
      .select('full_name')
      .eq('id', talentUserId)
      .maybeSingle();

    deliverSelectionCallback({
      external_id: externalId,
      recipient_id: recipientId,
      talent_user_id: talentUserId,
      talent_name: talent?.full_name ?? undefined,
      selected_at: now,
    }).catch((err) => {
      console.error('[subscription] deliverSelectionCallback threw', err);
    });
  }

  return { card_id: cardId, selected_talent_user_id: talentUserId };
}

export async function adminUndoSelection(cardId: string): Promise<void> {
  const { data: card } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, external_id, selected_at')
    .eq('id', cardId)
    .maybeSingle();
  if (!card) throw new AppError(404, 'Card not found');
  if (!(card as any).selected_at) throw new AppError(409, 'No selection to undo');

  await supabaseAdmin
    .from('subscription_card_recipients')
    .update({ selected_at: null, passed_over_at: null })
    .eq('card_id', cardId)
    .not('selected_at', 'is', null);

  await supabaseAdmin
    .from('subscription_card_recipients')
    .update({ passed_over_at: null })
    .eq('card_id', cardId)
    .not('passed_over_at', 'is', null);

  await supabaseAdmin
    .from('subscription_cards')
    .update({ selected_talent_user_id: null, selected_at: null })
    .eq('id', cardId);

  const externalId = (card as any).external_id as string | undefined;
  if (externalId) {
    deliverSelectionUndoCallback(externalId).catch((err) => {
      console.error('[subscription] deliverSelectionUndoCallback threw', err);
    });
  }
}

// ─── Webhook-driven selection (SquadHub selected a talent) ───────────────

export async function handleSelectionWebhook(
  externalCardId: string,
  talentIds: string[],
  selectedAt: string,
  cardStatus: 'assigned' | 'active' | 'archived' | null,
): Promise<void> {
  const { data: card } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, selected_at, content, status')
    .eq('external_id', externalCardId)
    .maybeSingle();
  if (!card) return;

  const cid = (card as any).id as string;

  if (talentIds.length > 0) {
    // Stamp selected on each specified talent
    await supabaseAdmin
      .from('subscription_card_recipients')
      .update({ selected_at: selectedAt, passed_over_at: null })
      .eq('card_id', cid)
      .eq('status', 'accepted')
      .in('talent_user_id', talentIds);

    // Pass over non-selected accepted talents
    await supabaseAdmin
      .from('subscription_card_recipients')
      .update({ passed_over_at: selectedAt })
      .eq('card_id', cid)
      .eq('status', 'accepted')
      .is('selected_at', null)
      .is('passed_over_at', null);

    for (const tid of talentIds) {
      notifySelected(cid, tid, (card as any).content ?? {}).catch((err) => {
        console.error('[subscription] notifySelected (webhook) threw', err);
      });
    }
  } else {
    // SquadHub selected only partners — pass over all accepted talents
    await supabaseAdmin
      .from('subscription_card_recipients')
      .update({ passed_over_at: selectedAt })
      .eq('card_id', cid)
      .eq('status', 'accepted')
      .is('passed_over_at', null);
  }

  const cardPatch: Record<string, unknown> = { selected_at: selectedAt };
  if (cardStatus) cardPatch.status = cardStatus;
  // Store the first selected talent at card level so the business portal
  // can always identify the selected talent even if the recipient-level
  // stamp is lost (e.g. partial webhook propagation).
  if (talentIds.length > 0) cardPatch.selected_talent_user_id = talentIds[0];
  await supabaseAdmin
    .from('subscription_cards')
    .update(cardPatch)
    .eq('id', cid);
}

export async function handleSelectionUndoWebhook(
  externalCardId: string,
): Promise<void> {
  const { data: card } = await supabaseAdmin
    .from('subscription_cards')
    .select('id')
    .eq('external_id', externalCardId)
    .maybeSingle();
  if (!card) return;

  await supabaseAdmin
    .from('subscription_card_recipients')
    .update({ selected_at: null, passed_over_at: null })
    .eq('card_id', (card as any).id)
    .not('selected_at', 'is', null);

  await supabaseAdmin
    .from('subscription_card_recipients')
    .update({ passed_over_at: null })
    .eq('card_id', (card as any).id)
    .not('passed_over_at', 'is', null);

  await supabaseAdmin
    .from('subscription_cards')
    .update({ selected_talent_user_id: null, selected_at: null, status: 'active' })
    .eq('id', (card as any).id);
}

// ─── Selection callback delivery to SquadHub ─────────────────────────────

interface SelectionCallbackPayload {
  external_id: string;
  recipient_id: string;
  talent_user_id: string;
  talent_name?: string;
  selected_at: string;
}

async function deliverSelectionCallback(payload: SelectionCallbackPayload): Promise<void> {
  const url = env.SQUADHUB_CALLBACK_URL;
  if (!url) return;

  const selectionUrl = url.replace(/\/card-responses\/?$/, '/card-selection');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.SQUADHUB_CALLBACK_SECRET) {
      headers['X-SquadHub-Signature'] = env.SQUADHUB_CALLBACK_SECRET;
    }
    await fetch(selectionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    console.warn('[subscription] selection callback failed', err instanceof Error ? err.message : err);
  } finally {
    clearTimeout(timer);
  }
}

async function deliverSelectionUndoCallback(externalId: string): Promise<void> {
  const url = env.SQUADHUB_CALLBACK_URL;
  if (!url) return;

  const undoUrl = url.replace(/\/card-responses\/?$/, '/card-selection-undo');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.SQUADHUB_CALLBACK_SECRET) {
      headers['X-SquadHub-Signature'] = env.SQUADHUB_CALLBACK_SECRET;
    }
    await fetch(undoUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ external_id: externalId }),
      signal: controller.signal,
    });
  } catch (err) {
    console.warn('[subscription] selection undo callback failed', err instanceof Error ? err.message : err);
  } finally {
    clearTimeout(timer);
  }
}
