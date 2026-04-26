import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { findMatchingTalents } from './subscription-matcher.service.js';
import { deliverCallback } from './squadhub-callback.service.js';
import type {
  IngestSubscriptionCardInput,
  ListSubscriptionsQueryInput,
  ManualAssignTalentInput,
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

async function resolveBusinessUserIdFromEmail(email: string | undefined): Promise<string | null> {
  if (!email) return null;

  // `business_users.contact_email` is the only email column. Match
  // case-insensitively in case existing rows were stored with mixed case.
  const { data, error } = await supabaseAdmin
    .from('business_users')
    .select('id')
    .ilike('contact_email', email)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[subscription] business_email lookup failed', { email, error: error.message });
    return null;
  }
  if (!data) {
    console.warn('[subscription] business_email did not match any business_users row', { email });
    return null;
  }
  return data.id as string;
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
  // Resolve the SquadHub-provided client email to a Profiles business_users
  // row. If unset or unresolved, the card still gets persisted but won't feed
  // into any business dashboard on talent accept.
  const businessUserId = await resolveBusinessUserIdFromEmail(input.business_email);

  const row = {
    external_id: input.external_id,
    content: input.content,
    match_rules: input.match_rules,
    published_at: input.published_at ?? new Date().toISOString(),
    expires_at: input.expires_at ?? null,
    business_user_id: businessUserId,
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
    const previousStatus = (existing as any).status as 'active' | 'archived';
    const nextStatus = input.status ?? previousStatus;
    const isRecall = previousStatus === 'active' && nextStatus === 'archived';
    const isRepublish = previousStatus === 'archived' && nextStatus === 'active';

    const updatePatch: Record<string, unknown> = {
      content: row.content,
      match_rules: row.match_rules,
      published_at: row.published_at,
      expires_at: row.expires_at,
      // Re-resolve on every ingest so SquadHub can correct the link by
      // re-publishing with a fixed business_email. Null overwrites a stale id.
      business_user_id: businessUserId,
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
    let recipientCount = 0;
    if (nextStatus === 'active') {
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
  const talentIds = await findMatchingTalents(input.match_rules ?? {});

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
  created_at: string;
  subscription_cards: {
    id: string;
    external_id: string;
    content: Record<string, unknown>;
    status: 'active' | 'archived';
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
  card: RecipientRow['subscription_cards'];
}>> {
  // No filter on subscription_cards.status — recalled cards stay visible to
  // the talent, annotated with a "Cancelled" tag (driven by cancelled_at).
  let q = supabaseAdmin
    .from('subscription_card_recipients')
    .select(
      'id, status, responded_at, cancelled_at, created_at, subscription_cards!inner(id, external_id, content, status, published_at, expires_at)'
    )
    .eq('talent_user_id', talentUserId)
    .order('created_at', { ascending: false });

  if (query.status === 'pending') {
    q = q.eq('status', 'pending');
  } else if (query.status === 'responded') {
    q = q.in('status', ['accepted', 'rejected']);
  }

  const { data, error } = await q;
  if (error) throw new AppError(500, error.message);

  return (data ?? []).map((r: any) => ({
    id: r.id,
    status: r.status,
    responded_at: r.responded_at,
    cancelled_at: r.cancelled_at,
    card: r.subscription_cards,
  }));
}

export async function getUnreadCount(talentUserId: string): Promise<number> {
  // Cancelled offers don't count as unread — the partner rescinded them.
  const { count, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('talent_user_id', talentUserId)
    .eq('status', 'pending')
    .is('cancelled_at', null);

  if (error) throw new AppError(500, error.message);
  return count ?? 0;
}

// ─── Admin-facing queries ──────────────────────────────────────────────────

export interface AdminCardRow {
  id: string;
  external_id: string;
  status: 'active' | 'archived';
  published_at: string;
  expires_at: string | null;
  business_name: string | null;
  subscription_name: string | null;
  plan_label: string | null;
  talents: { pending: number; accepted: number; rejected: number };
}

export interface AdminListCardsInput {
  status?: 'active' | 'archived';
  search?: string;
}

export async function listAllForAdmin(input: AdminListCardsInput): Promise<AdminCardRow[]> {
  let q = supabaseAdmin
    .from('subscription_cards')
    .select('id, external_id, status, published_at, expires_at, content')
    .order('published_at', { ascending: false });

  if (input.status === 'active' || input.status === 'archived') {
    q = q.eq('status', input.status);
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
    .select('card_id, status')
    .in('card_id', cardIds);
  if (recErr) throw new AppError(500, recErr.message);

  const countsByCard = new Map<string, { pending: number; accepted: number; rejected: number }>();
  for (const id of cardIds) {
    countsByCard.set(id, { pending: 0, accepted: 0, rejected: 0 });
  }
  for (const r of recipientRows ?? []) {
    const bucket = countsByCard.get((r as any).card_id);
    if (!bucket) continue;
    const status = (r as any).status as 'pending' | 'accepted' | 'rejected';
    if (status in bucket) bucket[status]++;
  }

  return list.map((c: any) => {
    const content = (c.content ?? {}) as Record<string, unknown>;
    return {
      id: c.id,
      external_id: c.external_id,
      status: c.status,
      published_at: c.published_at,
      expires_at: c.expires_at,
      business_name: (content.brand_name as string) ?? null,
      subscription_name: (content.subscription_name as string) ?? null,
      plan_label: (content.plan_name as string) ?? null,
      talents: countsByCard.get(c.id) ?? { pending: 0, accepted: 0, rejected: 0 },
    };
  });
}

export interface AdminCardRecipient {
  id: string;
  talent_user_id: string;
  talent_name: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  responded_at: string | null;
  created_at: string;
}

export async function listRecipientsForAdmin(cardId: string): Promise<AdminCardRecipient[]> {
  const { data, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, talent_user_id, status, responded_at, created_at')
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

  return rows.map((r: any) => ({
    id: r.id,
    talent_user_id: r.talent_user_id,
    talent_name: nameById.get(r.talent_user_id) ?? null,
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
    .select('id')
    .eq('external_id', input.card_id)
    .maybeSingle();
  if (cardErr) throw new AppError(500, cardErr.message);
  if (!card) throw new AppError(404, 'Subscription card not found on Profiles');

  const { data: talent, error: talentErr } = await supabaseAdmin
    .from('talent_users')
    .select('id')
    .eq('id', input.talent_id)
    .maybeSingle();
  if (talentErr) throw new AppError(500, talentErr.message);
  if (!talent) throw new AppError(404, 'Talent not found');

  const { data: existing } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id')
    .eq('card_id', (card as any).id)
    .eq('talent_user_id', input.talent_id)
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

  return {
    card_id: (card as any).id as string,
    talent_user_id: input.talent_id,
    inserted: true,
  };
}
