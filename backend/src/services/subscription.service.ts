import crypto from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { findMatchingTalents } from './subscription-matcher.service.js';
import { deliverCallback } from './squadhub-callback.service.js';
import { notifyNewCard, notifySelected, notifyUnassigned } from './push.service.js';
import { getTalentTiersByUserIds } from './talent-tier.service.js';
import { notifyTalentSubscriptionCardReceived } from './talent-whatsapp.service.js';
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
    // group_id: links the per-tier sibling cards of one multi-tier brief so the
    // business dashboard collapses them into a single tabbed card. Written on
    // every ingest so a re-publish can set or clear it.
    group_id: input.group_id ?? null,
    // card_type: which client path this card belongs to (subscription /
    // assignment / hiring). Written on every ingest so a re-publish can change
    // it. Talent clients tag by it; the business portal splits Assignments out.
    card_type: input.card_type ?? 'subscription',
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
      group_id: row.group_id,
      card_type: row.card_type,
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

    // Republish (archived → active) or plain edit while active: re-run the
    // matcher and reconcile recipients against the new match set.
    //   - INSERT new matches that don't already have an active row.
    //   - PRUNE (cancel) PENDING recipients that no longer match. match_rules
    //     can tighten between publishes (e.g. SquadHub adds target_tiers on
    //     re-publish) and without pruning, stale pending recipients from the
    //     looser previous match are left attached and reach talents who no
    //     longer qualify.
    //   - PRESERVE accepted/rejected recipients regardless of new match — those
    //     responses are audit; the talent already engaged with the card.
    //
    // The partial unique index `WHERE cancelled_at IS NULL` can't be inferred
    // by PostgREST's ON CONFLICT, so we read existing active rows, diff against
    // the matched talents, and INSERT only the missing ones. Cancelled rows
    // from prior rounds stay around as audit.
    //
    // Manual cards are exempt: they only ever surface to talents through
    // /manual-assignments, never auto-fan-out, even on republish.
    let recipientCount = 0;
    if (nextStatus === 'active' && !skipAutoFanOut) {
      const talentIds = await findMatchingTalents(input.match_rules ?? {});
      const matchedSet = new Set(talentIds);

      // Always load existing active recipients — the prune step needs them
      // even when talentIds is empty (e.g. new match_rules match nobody).
      const { data: existingRows, error: existErr } = await supabaseAdmin
        .from('subscription_card_recipients')
        .select('talent_user_id, status')
        .eq('card_id', existing.id)
        .is('cancelled_at', null);

      if (existErr) {
        console.error('[subscription] failed to read existing recipients', existErr);
      } else {
        const existingByTalent = new Map<string, string>();
        (existingRows ?? []).forEach((r: any) => {
          existingByTalent.set(r.talent_user_id as string, r.status as string);
        });

        // Prune: cancel PENDING recipients no longer in the match set.
        // accepted/rejected are skipped so the response stays in the audit trail.
        const staleTalentIds: string[] = [];
        for (const [tid, status] of existingByTalent) {
          if (status === 'pending' && !matchedSet.has(tid)) {
            staleTalentIds.push(tid);
          }
        }
        if (staleTalentIds.length > 0) {
          const { error: pruneErr, count: prunedCount } = await supabaseAdmin
            .from('subscription_card_recipients')
            .update({ cancelled_at: new Date().toISOString() }, { count: 'exact' })
            .eq('card_id', existing.id)
            .eq('status', 'pending')
            .is('cancelled_at', null)
            .in('talent_user_id', staleTalentIds);
          if (pruneErr) {
            console.error('[subscription] failed to prune stale recipients', pruneErr);
          } else {
            console.info('[subscription] pruned stale pending recipients', {
              external_id: input.external_id,
              card_id: existing.id,
              pruned_count: prunedCount ?? staleTalentIds.length,
            });
          }
        }

        // Insert NEW matches that don't already have an active row.
        const newTalentIds = talentIds.filter((id) => !existingByTalent.has(id));
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
            // Ingest is a silent sync by default: the recipient rows above make
            // the card visible in talent queues, but talents are only *notified*
            // (push + WhatsApp) on an explicit broadcast. Flip
            // NOTIFY_TALENT_ON_INGEST=true to also notify on ingest/edit.
            if (env.NOTIFY_TALENT_ON_INGEST) {
              const updateContent = input.content ?? {};
              notifyNewCard(existing.id, newTalentIds, updateContent).catch((err) => {
                console.error('[subscription] notifyNewCard (update) threw', err);
              });
              for (const tid of newTalentIds) {
                notifyTalentSubscriptionCardReceived(tid, existing.id, updateContent).catch((err) => {
                  console.error('[subscription] notifyTalentSubscriptionCardReceived (update) threw', err);
                });
              }
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
      // Silent sync by default — the rows above make the card visible in talent
      // queues, but talents are only notified on an explicit broadcast. Flip
      // NOTIFY_TALENT_ON_INGEST=true to also notify on ingest.
      if (env.NOTIFY_TALENT_ON_INGEST) {
        const insertContent = input.content ?? {};
        notifyNewCard(inserted.id, talentIds, insertContent).catch((err) => {
          console.error('[subscription] notifyNewCard threw', err);
        });
        for (const tid of talentIds) {
          notifyTalentSubscriptionCardReceived(tid, inserted.id, insertContent).catch((err) => {
            console.error('[subscription] notifyTalentSubscriptionCardReceived threw', err);
          });
        }
      }
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
    // Product line. Talent clients render a "Subscription" / "Assignment" tag
    // off this (both types share the same Pending/Responded feed).
    card_type: 'subscription' | 'assignment' | 'hiring';
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
  // Subscriptions and Assignments are separate talent modules — list one line.
  const cardType = (query as { card_type?: 'subscription' | 'assignment' }).card_type ?? 'subscription';
  let q = supabaseAdmin
    .from('subscription_card_recipients')
    .select(
      'id, status, responded_at, cancelled_at, selected_at, passed_over_at, created_at, viewed_at, subscription_cards!inner(id, external_id, content, status, published_at, expires_at, archived_at, card_type)'
    )
    .eq('talent_user_id', talentUserId)
    .eq('subscription_cards.card_type', cardType)
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
    // Responded tab = everything the talent acted on, accepted or rejected.
    // (Web merges the old Accepted / Rejected tabs into one.) Cancelled-but-
    // responded rows stay visible, annotated with a Cancelled tag, same as the
    // legacy accepted/rejected tabs.
    q = q.in('status', ['accepted', 'rejected']);
  } else if (query.status === 'expired') {
    // Expired tab = the talent never responded, but the card was already given
    // to someone else. On selection SquadHub stamps card.status='assigned',
    // which drops these out of Pending (it requires an active card), so today
    // they silently vanish. Surface them read-only so the talent can see the
    // offer closed without them. cancelled_at IS NULL keeps recalled/closed
    // cards out — that's a different (Cancelled) state, not "someone else got
    // it".
    q = q
      .eq('status', 'pending')
      .is('cancelled_at', null)
      .eq('subscription_cards.status', 'assigned');
  } else if (query.status === 'accepted') {
    q = q.eq('status', 'accepted');
  } else if (query.status === 'rejected') {
    q = q.eq('status', 'rejected');
  } else {
    // 'all' — show responded (cancelled or not) and active-pending; hide
    // cancelled-pending for the same reason as above.
    q = q.or('status.in.(accepted,rejected),cancelled_at.is.null');
  }

  const { data, error } = await q;
  if (error) throw new AppError(500, error.message);

  // Stamp viewed_at on any returned recipient row that hasn't been viewed yet.
  // This is the engagement signal that releases the talent-WhatsApp throttle:
  // once they've opened the queue, the next card-arrival fires immediately
  // instead of waiting on the 1/day cap.
  const unviewedIds = (data ?? [])
    .filter((r: any) => r.viewed_at == null)
    .map((r: any) => r.id as string);
  if (unviewedIds.length > 0) {
    supabaseAdmin
      .from('subscription_card_recipients')
      .update({ viewed_at: new Date().toISOString() })
      .in('id', unviewedIds)
      .is('viewed_at', null)
      .then(({ error: updErr }) => {
        if (updErr) console.error('[subscription] viewed_at stamp failed', updErr);
      });
  }

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

// ─── My Clients: cards where this talent has been selected ────────────────

export interface MyClientRow {
  recipient_id: string;
  card_id: string;
  external_id: string;
  selected_at: string;
  subscription_activated_at: string | null;
  brand_name: string | null;
  business_nature: string | null;
  plan_name: string | null;
  subscription_name: string | null;
  monthly_price: number | null;
  currency: string | null;
  price_label: string | null;
  hours_label: string | null;
  working_days: string[] | null;
  custom_deliverables: Array<Record<string, unknown>>;
}

export interface MyClientsResponse {
  selected: MyClientRow[];
  assigned: MyClientRow[];
  earnings: { monthly_total: number; currency: string };
  commitment: { hours_per_day: number; hours_per_week: number; hours_per_month: number };
}

// Parse a string like "2.5 hrs/day" or "12.5 hrs/week" → numeric hours and
// the cadence bucket. Loose but good enough as a fallback when a card has no
// structured hours deliverable. Returns null for unparseable input.
function parseHoursLabel(raw: string | null): { value: number; per: 'day' | 'week' | 'month' } | null {
  if (!raw) return null;
  const m = raw.match(/([\d.]+)\s*hr?s?\s*\/\s*(day|week|month)/i);
  if (!m) return null;
  const value = Number.parseFloat(m[1]);
  if (!Number.isFinite(value)) return null;
  return { value, per: m[2].toLowerCase() as 'day' | 'week' | 'month' };
}

function clientRowFromContent(
  row: { id: string; selected_at: string | null; card: any },
): MyClientRow {
  const card = row.card ?? {};
  const content = (card.content ?? {}) as Record<string, any>;
  const monthly_price = typeof content.monthly_price === 'number' ? content.monthly_price : null;
  return {
    recipient_id: row.id,
    card_id: card.id,
    external_id: card.external_id,
    selected_at: row.selected_at as string,
    subscription_activated_at: card.subscription_activated_at ?? null,
    brand_name: content.brand_name ?? null,
    business_nature: content.business_nature ?? null,
    plan_name: content.plan_name ?? null,
    subscription_name: content.subscription_name ?? null,
    monthly_price,
    currency: content.currency ?? 'INR',
    price_label: content.price_label ?? null,
    hours_label: content.hours_label ?? null,
    working_days: Array.isArray(content.working_days) ? content.working_days : null,
    custom_deliverables: Array.isArray(content.custom_deliverables)
      ? content.custom_deliverables
      : [],
  };
}

function aggregateAssigned(assigned: MyClientRow[]): {
  earnings: MyClientsResponse['earnings'];
  commitment: MyClientsResponse['commitment'];
} {
  let monthly_total = 0;
  let currency = 'INR';
  let hours_per_day = 0;
  let hours_per_week = 0;
  let hours_per_month = 0;

  for (const row of assigned) {
    if (typeof row.monthly_price === 'number') {
      monthly_total += row.monthly_price;
      if (row.currency) currency = row.currency;
    }

    // Prefer structured deliverables when available.
    const hoursDeliverables = row.custom_deliverables.filter(
      (d) => (d as any).kind === 'hours',
    );
    if (hoursDeliverables.length > 0) {
      for (const d of hoursDeliverables) {
        if (typeof (d as any).per_day === 'number') hours_per_day += (d as any).per_day;
        if (typeof (d as any).per_week === 'number') hours_per_week += (d as any).per_week;
        if (typeof (d as any).per_month === 'number') hours_per_month += (d as any).per_month;
      }
      continue;
    }

    // Fall back to the loose hours_label string.
    const parsed = parseHoursLabel(row.hours_label);
    if (!parsed) continue;
    if (parsed.per === 'day') hours_per_day += parsed.value;
    else if (parsed.per === 'week') hours_per_week += parsed.value;
    else hours_per_month += parsed.value;
  }

  return {
    earnings: { monthly_total, currency },
    commitment: { hours_per_day, hours_per_week, hours_per_month },
  };
}

export async function listMyClients(talentUserId: string): Promise<MyClientsResponse> {
  const { data, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select(
      'id, selected_at, subscription_cards!inner(id, external_id, content, status, archived_at, subscription_activated_at)'
    )
    .eq('talent_user_id', talentUserId)
    .not('selected_at', 'is', null)
    // A cancelled row is a retired round (recall / fresh broadcast), never a
    // live client — required because a fresh broadcast returns the card to
    // 'active', so the archived_at join filter alone no longer excludes it.
    .is('cancelled_at', null)
    .is('subscription_cards.archived_at', null)
    .order('selected_at', { ascending: false });

  if (error) throw new AppError(500, error.message);

  const selected: MyClientRow[] = [];
  const assigned: MyClientRow[] = [];

  for (const raw of (data ?? []) as any[]) {
    const row = clientRowFromContent({
      id: raw.id,
      selected_at: raw.selected_at,
      card: raw.subscription_cards,
    });
    if (row.subscription_activated_at) assigned.push(row);
    else selected.push(row);
  }

  const { earnings, commitment } = aggregateAssigned(assigned);

  return { selected, assigned, earnings, commitment };
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
    // Subscriptions badge counts subscription offers only — assignments have
    // their own module.
    .eq('subscription_cards.card_type', 'subscription')
    // Mirror listForTalent: hard-archived cards never count as unread.
    .is('subscription_cards.archived_at', null);

  if (error) throw new AppError(500, error.message);
  return count ?? 0;
}

// ─── Admin-facing queries ──────────────────────────────────────────────────

export interface AdminCardRow {
  id: string;
  external_id: string | null;
  status: 'active' | 'assigned' | 'archived';
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
  selected_at: string | null;
  // Set once SquadHub finalizes the selection — the card is then "Assigned"
  // (the talent is live in their My Clients tab). Lets the admin UI tell the
  // pre-activation "Selected" state apart from the post-activation "Assigned".
  subscription_activated_at: string | null;
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
    .select('id, external_id, status, distribution, published_at, expires_at, content, match_rules, source, subscription_request_id, selected_talent_user_id, selected_at, subscription_activated_at')
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
      selected_at: c.selected_at ?? null,
      subscription_activated_at: c.subscription_activated_at ?? null,
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
    .select('id, external_id, status, distribution, published_at, expires_at, content, match_rules, source, subscription_request_id, selected_talent_user_id, selected_at, subscription_activated_at')
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
    selected_at: (c as any).selected_at ?? null,
    subscription_activated_at: (c as any).subscription_activated_at ?? null,
  };
}

export interface AdminCardRecipient {
  id: string;
  talent_user_id: string;
  talent_name: string | null;
  tier: 'junior' | 'pro' | 'Top Talents' | 'custom' | null;
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

/**
 * Read-only preview of who a card's match_rules WOULD reach, without ingesting
 * the card, writing any recipient rows, or notifying anyone. Used by SquadHub
 * to show the matching-talent audience on a published (not-yet-broadcast) card.
 *
 * Runs the same matcher (`findMatchingTalents`) that broadcast delivery uses,
 * then resolves display names. Returns names only — no email/PII — since this
 * is a pre-broadcast preview, not the real recipient list.
 */
export async function previewRecipientsByRules(
  matchRules: Record<string, unknown>,
): Promise<{ count: number; talents: Array<{ talent_user_id: string; talent_name: string }> }> {
  const talentIds = await findMatchingTalents(matchRules as any);
  if (talentIds.length === 0) return { count: 0, talents: [] };

  const { data: talents, error } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name')
    .in('id', talentIds);
  if (error) throw new AppError(500, error.message);

  const nameById = new Map<string, string>();
  for (const t of talents ?? []) {
    const u = t as { id: string; full_name: string | null };
    nameById.set(u.id, u.full_name || 'Unknown talent');
  }

  const list = talentIds.map((id) => ({
    talent_user_id: id,
    talent_name: nameById.get(id) ?? 'Unknown talent',
  }));
  return { count: list.length, talents: list };
}

// ─── Talent response ───────────────────────────────────────────────────────

export async function respond(
  talentUserId: string,
  recipientId: string,
  input: RespondToSubscriptionInput
) {
  const newStatus = input.action === 'accept' ? 'accepted' : 'rejected';
  const respondedAt = new Date().toISOString();

  // Block responses to a card that's no longer live. A recipient row can still
  // read 'pending' on a card that's been FILLED (status='assigned' once another
  // talent was selected) — pending talents aren't auto-rejected — so the
  // status/cancelled_at guards below aren't enough on their own. Without this a
  // talent on a stale screen or an older app build could accept an already-taken
  // slot.
  const { data: cardRow } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('subscription_cards!inner(status)')
    .eq('id', recipientId)
    .eq('talent_user_id', talentUserId)
    .maybeSingle();
  if (cardRow && (cardRow as any).subscription_cards?.status !== 'active') {
    throw new AppError(409, 'This offer is no longer available');
  }

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

  // A (card, talent) pair can hold several rows once a round has been retired
  // (recall / fresh broadcast): at most one active row (partial unique index
  // WHERE cancelled_at IS NULL) plus cancelled audit rows. Prefer the active
  // row; fall back to a cancelled one so the 409 below still explains itself.
  const { data: existing, error: readErr } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, status, cancelled_at')
    .eq('card_id', (card as any).id)
    .eq('talent_user_id', talentUserId)
    .order('cancelled_at', { ascending: false, nullsFirst: true })
    .limit(1)
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
    .select('id, content, status, selected_talent_user_id, business_user_id, match_rules')
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
    .select('id, status, selected_at')
    .eq('card_id', (card as any).id)
    .eq('talent_user_id', input.talent_id)
    .is('cancelled_at', null)
    .maybeSingle();

  const manualContent = (card as any).content ?? {};

  // Direct-assign mode (SquadHub change-talent on a live assignment): the
  // talent is already the finalized recipient on the SquadHub side, so record
  // them as accepted + selected and promote the card in one step. A plain
  // pending offer would never surface — My Clients requires selected_at, and
  // a pending row joined to an 'assigned' card renders in the Expired tab.
  if (input.assigned === true) {
    const assignedAt = input.assigned_at ?? new Date().toISOString();

    // Idempotency: the talent is already selected here AND the card already
    // points at them (a sweeper retry after a delivery that actually landed,
    // or a re-fired webhook). Rewriting the stamps and re-pushing "You've
    // been selected!" would only spam the talent — bail as a no-op.
    if (
      existing &&
      (existing as any).selected_at != null &&
      (card as any).selected_talent_user_id === input.talent_id
    ) {
      return {
        card_id: (card as any).id as string,
        talent_user_id: input.talent_id,
        inserted: false,
      };
    }

    if (existing) {
      const patch: Record<string, unknown> = {
        selected_at: assignedAt,
        passed_over_at: null,
      };
      // Preserve a real acceptance's responded_at; promote anything else.
      if ((existing as any).status !== 'accepted') {
        patch.status = 'accepted';
        patch.responded_at = assignedAt;
      }
      const { error: updErr } = await supabaseAdmin
        .from('subscription_card_recipients')
        .update(patch)
        .eq('id', (existing as any).id);
      if (updErr) throw new AppError(500, updErr.message);
    } else {
      const { error: insErr } = await supabaseAdmin
        .from('subscription_card_recipients')
        .insert({
          card_id: (card as any).id,
          talent_user_id: input.talent_id,
          status: 'accepted',
          responded_at: assignedAt,
          selected_at: assignedAt,
        });
      if (insErr) throw new AppError(500, insErr.message);
    }

    // Pass over other accepted-but-unselected recipients (mirrors the
    // selection webhook) so the round reads as decided. Live round only —
    // cancelled rows are retired audit state from an earlier round.
    await supabaseAdmin
      .from('subscription_card_recipients')
      .update({ passed_over_at: assignedAt })
      .eq('card_id', (card as any).id)
      .eq('status', 'accepted')
      .neq('talent_user_id', input.talent_id)
      .is('cancelled_at', null)
      .is('selected_at', null)
      .is('passed_over_at', null);

    // Promote the card: pointer + stamps so My Clients shows it as Assigned
    // immediately (activation webhook re-stamping activated_at is idempotent).
    const { error: cardUpdErr } = await supabaseAdmin
      .from('subscription_cards')
      .update({
        selected_talent_user_id: input.talent_id,
        selected_at: assignedAt,
        subscription_activated_at: assignedAt,
        status: 'assigned',
      })
      .eq('id', (card as any).id);
    if (cardUpdErr) throw new AppError(500, cardUpdErr.message);

    // Surface the talent on the linked business's dashboard — the removal leg
    // of a swap withdraws the OUTGOING talent's share, and neither respond()
    // nor the talent-accepted webhook fires for a synthesized acceptance
    // (the latter short-circuits on alreadyAccepted), so without this write
    // the business would see no shared talent at all after a swap.
    const businessUserId = (card as any).business_user_id as string | null;
    if (businessUserId) {
      try {
        await writeAcceptedTalentToDashboard(
          businessUserId,
          input.talent_id,
          (card as any).match_rules,
        );
      } catch (err) {
        console.error('[subscription] writeAcceptedTalentToDashboard (direct assign) threw', err);
      }
    }

    notifySelected((card as any).id, input.talent_id, manualContent).catch((err) => {
      console.error('[subscription] notifySelected (direct assign) threw', err);
    });

    return {
      card_id: (card as any).id as string,
      talent_user_id: input.talent_id,
      inserted: !existing,
    };
  }

  if (existing) {
    // The recipient row already exists — e.g. the card was synced to Profiles
    // during soft-publish and is only now being broadcast. A manual assignment
    // IS the explicit "notify the talent now" signal, so still fire the
    // notifications instead of bailing silently (otherwise "Broadcast to
    // talents" never reaches push/WhatsApp for pre-synced recipients). Guard on
    // `pending` so we don't re-ping talents who already accepted/rejected.
    // WhatsApp de-duplication (2-min burst window + 24h engagement throttle)
    // lives inside notifyTalentSubscriptionCardReceived, so re-firing is safe.
    if ((existing as any).status === 'pending') {
      notifyNewCard((card as any).id, [input.talent_id], manualContent).catch((err) => {
        console.error('[subscription] notifyNewCard (manual re-notify) threw', err);
      });
      notifyTalentSubscriptionCardReceived(input.talent_id, (card as any).id, manualContent).catch((err) => {
        console.error('[subscription] notifyTalentSubscriptionCardReceived (manual re-notify) threw', err);
      });
    }
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

  notifyNewCard((card as any).id, [input.talent_id], manualContent).catch((err) => {
    console.error('[subscription] notifyNewCard (manual) threw', err);
  });
  notifyTalentSubscriptionCardReceived(input.talent_id, (card as any).id, manualContent).catch((err) => {
    console.error('[subscription] notifyTalentSubscriptionCardReceived (manual) threw', err);
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
 * SquadHub admin removed a previously-assigned talent from a card. Retires the
 * talent's active recipient row (soft-cancel, same pattern as recall /
 * freshBroadcast) so the offer leaves their Pending tab while a responded row
 * stays visible with a Cancelled tag; already-cancelled rows from retired
 * rounds are audit history and stay untouched. A hard delete here would wipe
 * that history and leave any late SquadHub callback pointing at a missing row.
 *
 * Idempotent: returns `removed: 0` if there is no ACTIVE row for the pair (or
 * the card itself is unknown) — common after a Recall on the SquadHub side,
 * which already cancelled the rows and may fire removals for the same talents.
 * `removed` counts newly-cancelled rows (0 or 1 under the partial unique
 * index), so retries stay silent and never re-notify.
 */
export async function removeAssignedTalent(
  input: RemoveAssignedTalentInput
): Promise<RemoveAssignedTalentResult> {
  const { data: card } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, selected_talent_user_id, content')
    .eq('external_id', input.card_id)
    .maybeSingle();
  if (!card) {
    return { card_id: null, talent_user_id: input.talent_id, removed: 0 };
  }

  // Selection stamps are cleared for the same reason freshBroadcast clears
  // them: My Clients keys on selected_at, and a cancelled row must not read
  // as a live decision anywhere. manualAssignTalent / fanOutBroadcast both
  // skip cancelled rows, so a later re-assignment inserts a fresh row.
  const { error, count } = await supabaseAdmin
    .from('subscription_card_recipients')
    .update(
      {
        cancelled_at: input.removed_at ?? new Date().toISOString(),
        selected_at: null,
        passed_over_at: null,
      },
      { count: 'exact' },
    )
    .eq('card_id', (card as any).id)
    .eq('talent_user_id', input.talent_id)
    .is('cancelled_at', null);
  if (error) throw new AppError(500, error.message);

  // If this talent was the card-level assignee, clear the pointer so the admin
  // Published Cards badge / business portal stop naming a talent whose
  // recipient row is retired. Guarded on a match so a racing direct-assign for a
  // REPLACEMENT talent (change-talent fires removal + assignment concurrently)
  // is never clobbered — by then the pointer names the new talent, not this one.
  if ((card as any).selected_talent_user_id === input.talent_id) {
    const { error: ptrErr } = await supabaseAdmin
      .from('subscription_cards')
      .update({ selected_talent_user_id: null })
      .eq('id', (card as any).id)
      .eq('selected_talent_user_id', input.talent_id);
    if (ptrErr) {
      console.error('[subscription] removeAssignedTalent pointer clear failed', ptrErr);
    }
  }

  // Best-effort: withdraw the talent's profile from the linked business's
  // dashboard (written at acceptance). Idempotent — removed:0 when no share.
  try {
    await removeFromBusinessDashboard(input.card_id, input.talent_id);
  } catch (err) {
    console.error('[subscription] removeAssignedTalent dashboard cleanup failed', err);
  }

  // A live engagement ending should not be silent — SquadHub's change-talent
  // sets notify:true. Pre-broadcast hand-pick removals keep the old silence.
  if (input.notify === true && (count ?? 0) > 0) {
    notifyUnassigned(
      (card as any).id,
      input.talent_id,
      ((card as any).content ?? {}) as Record<string, unknown>,
    ).catch((err) => {
      console.error('[subscription] notifyUnassigned (manual removal) threw', err);
    });
  }

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

  // Mark card. Set status='assigned' (same as the SquadHub-admin webhook path,
  // handleSelectionWebhook) so the slot reads as filled everywhere: the card
  // leaves other un-responded talents' Pending tab and surfaces in Expired,
  // and passed-over accepted talents get the "Closed" badge. Without this the
  // card stayed 'active' and others could still see — and accept — a taken slot.
  // adminUndoSelection resets status back to 'active', so unassign/reopen still work.
  await supabaseAdmin
    .from('subscription_cards')
    .update({ status: 'assigned', selected_talent_user_id: talentUserId, selected_at: now })
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

/**
 * Clear a card's selection/assignment and reopen it.
 *
 * Funnels BOTH the pre-activation "Selected" state and the post-activation
 * "Assigned" state (subscription_activated_at set) back to a clean `active`
 * card with no selected talent. This is the shared primitive behind the admin
 * "Unassign", "Reassign" (unassign → pick another), and "Reopen" actions.
 *
 * - recipients: clears selected_at + passed_over_at, so accepted talents stay
 *   accepted and become re-selectable.
 * - card: clears selected_talent_user_id, selected_at, subscription_activated_at
 *   and resets status to 'active'.
 * - SquadHub: always fires the selection-undo callback; ADDITIONALLY fires the
 *   activation-undo callback when the card had been activated, so SquadHub can
 *   reverse the live subscription on their side.
 * - notifies the unassigned talent (push).
 */
export async function adminUndoSelection(cardId: string): Promise<void> {
  const { data: card } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, external_id, selected_at, selected_talent_user_id, subscription_activated_at, content')
    .eq('id', cardId)
    .maybeSingle();
  if (!card) throw new AppError(404, 'Card not found');
  if (!(card as any).selected_at) throw new AppError(409, 'No selection to undo');

  const wasActivated = Boolean((card as any).subscription_activated_at);
  const previousTalentId = (card as any).selected_talent_user_id as string | null;

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
    .update({
      selected_talent_user_id: null,
      selected_at: null,
      subscription_activated_at: null,
      status: 'active',
    })
    .eq('id', cardId);

  const externalId = (card as any).external_id as string | undefined;
  if (externalId) {
    deliverSelectionUndoCallback(externalId).catch((err) => {
      console.error('[subscription] deliverSelectionUndoCallback threw', err);
    });
    // The card had a live subscription on SquadHub — ask them to reverse it.
    if (wasActivated) {
      deliverActivationUndoCallback(externalId, new Date().toISOString()).catch((err) => {
        console.error('[subscription] deliverActivationUndoCallback threw', err);
      });
    }
  }

  // Let the previously selected/assigned talent know they were unassigned.
  if (previousTalentId) {
    notifyUnassigned(cardId, previousTalentId, ((card as any).content ?? {}) as Record<string, unknown>).catch((err) => {
      console.error('[subscription] notifyUnassigned threw', err);
    });
  }
}

/**
 * Broadcast fan-out: find talents matching the card's rules and insert a
 * `pending` recipient row for each (existing rows are left intact via
 * ignoreDuplicates). Notifies each matched talent. Shared by the admin publish
 * flow and the "reopen for new talents" action. No-op when the card has no
 * category match rules. Returns the number of talents matched.
 */
export async function fanOutBroadcast(
  cardId: string,
  matchRules: Record<string, unknown>,
  content: Record<string, unknown>,
): Promise<number> {
  const categoryIds = extractCategoryIds(matchRules);
  if (categoryIds.length === 0) return 0;

  const talentIds = await findMatchingTalents(matchRules as any);
  if (talentIds.length === 0) return 0;

  // Insert a pending row for each matched talent that doesn't already have an
  // active (non-cancelled) one. We CANNOT `.upsert({ onConflict: 'card_id,
  // talent_user_id' })` here: the only unique index on that pair is PARTIAL
  // (`... WHERE cancelled_at IS NULL`), so Postgres rejects the ON CONFLICT
  // arbiter and the write errors out. Left unchecked, that silently inserted
  // ZERO rows while the notify loop below still fired — talents got a WhatsApp
  // for a card with no recipient row, so it never showed in their subscription
  // list. Dedup in code + a plain insert avoids the partial-index arbiter.
  const { data: existingRows, error: existErr } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('talent_user_id')
    .eq('card_id', cardId)
    .is('cancelled_at', null);
  if (existErr) {
    throw new AppError(500, `fanOutBroadcast: failed to read existing recipients: ${existErr.message}`);
  }
  const existing = new Set((existingRows ?? []).map((r: any) => r.talent_user_id as string));
  const toInsert = talentIds.filter((tid) => !existing.has(tid));
  if (toInsert.length > 0) {
    const { error: insErr } = await supabaseAdmin
      .from('subscription_card_recipients')
      .insert(
        toInsert.map((tid) => ({
          card_id: cardId,
          talent_user_id: tid,
          status: 'pending' as const,
        })),
      );
    // 23505 = a concurrent fan-out inserted the same row first; that's fine.
    // Any OTHER error means the rows aren't there — abort BEFORE notifying so
    // we never message talents about a card they can't see (the bug above).
    if (insErr && insErr.code !== '23505') {
      throw new AppError(500, `fanOutBroadcast: failed to insert recipients: ${insErr.message}`);
    }
  }

  // Rows now exist for every matched talent → safe to notify via both channels
  // (push + WhatsApp). Ingest is a silent sync by default
  // (NOTIFY_TALENT_ON_INGEST), so the broadcast is the point where talents
  // actually get pinged.
  notifyNewCard(cardId, talentIds, content).catch((err) => {
    console.error('[subscription] notifyNewCard (fan-out) threw', err);
  });
  for (const tid of talentIds) {
    notifyTalentSubscriptionCardReceived(tid, cardId, content).catch((err) => {
      console.error('[subscription] notifyTalentSubscriptionCardReceived (fan-out) threw', err);
    });
  }

  return talentIds.length;
}

/**
 * Reopen an assigned/selected card to a fresh pool of talents. Clears any
 * existing assignment, then (for broadcast cards) re-runs the matcher fan-out.
 * Manual cards are only cleared — talents are re-added via SquadHub manual
 * assignment. Returns how many talents the broadcast matched (0 for manual).
 */
export async function reopenForNewTalents(cardId: string): Promise<{ matched: number }> {
  const { data: card } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, distribution, match_rules, content, selected_at, status')
    .eq('id', cardId)
    .maybeSingle();
  if (!card) throw new AppError(404, 'Card not found');

  // Clear any current assignment first (resets selection + activation + status).
  if ((card as any).selected_at) {
    await adminUndoSelection(cardId);
  } else if ((card as any).status !== 'active') {
    await supabaseAdmin.from('subscription_cards').update({ status: 'active' }).eq('id', cardId);
  }

  let matched = 0;
  if ((card as any).distribution === 'broadcast') {
    matched = await fanOutBroadcast(
      cardId,
      ((card as any).match_rules ?? {}) as Record<string, unknown>,
      ((card as any).content ?? {}) as Record<string, unknown>,
    );
  }
  return { matched };
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
    // Stamp selected on each specified talent. cancelled_at IS NULL keeps
    // retired rounds' rows (recall / fresh broadcast) untouched — only the
    // live round carries selection state.
    await supabaseAdmin
      .from('subscription_card_recipients')
      .update({ selected_at: selectedAt, passed_over_at: null })
      .eq('card_id', cid)
      .eq('status', 'accepted')
      .is('cancelled_at', null)
      .in('talent_user_id', talentIds);

    // Pass over non-selected accepted talents
    await supabaseAdmin
      .from('subscription_card_recipients')
      .update({ passed_over_at: selectedAt })
      .eq('card_id', cid)
      .eq('status', 'accepted')
      .is('cancelled_at', null)
      .is('selected_at', null)
      .is('passed_over_at', null);

    for (const tid of talentIds) {
      notifySelected(cid, tid, (card as any).content ?? {}).catch((err) => {
        console.error('[subscription] notifySelected (webhook) threw', err);
      });
    }
  } else {
    // SquadHub selected only partners — pass over all accepted talents
    // (live round only; cancelled rows are retired audit state).
    await supabaseAdmin
      .from('subscription_card_recipients')
      .update({ passed_over_at: selectedAt })
      .eq('card_id', cid)
      .eq('status', 'accepted')
      .is('cancelled_at', null)
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

// SquadHub admin clicked "Finalize" on a selected card. We just stamp
// subscription_activated_at so the talent's My Clients tab moves this card
// from Selected → Assigned. Idempotent: re-firing rewrites the same field.
export async function handleActivationWebhook(
  externalCardId: string,
  activatedAt: string,
): Promise<void> {
  const { data: card } = await supabaseAdmin
    .from('subscription_cards')
    .select('id')
    .eq('external_id', externalCardId)
    .maybeSingle();
  if (!card) return;

  await supabaseAdmin
    .from('subscription_cards')
    .update({ subscription_activated_at: activatedAt })
    .eq('id', (card as any).id);
}

export async function handleSelectionUndoWebhook(
  externalCardId: string,
): Promise<void> {
  const { data: card } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, selected_talent_user_id, content')
    .eq('external_id', externalCardId)
    .maybeSingle();
  if (!card) return;

  const previousTalentId = (card as any).selected_talent_user_id as string | null;

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
    .update({ selected_talent_user_id: null, selected_at: null, subscription_activated_at: null, status: 'active' })
    .eq('id', (card as any).id);

  // Notify the previously selected/assigned talent that their client was removed
  // (covers SquadHub-initiated unassign + reopen, both of which fire this).
  if (previousTalentId) {
    notifyUnassigned((card as any).id, previousTalentId, ((card as any).content ?? {}) as Record<string, unknown>).catch((err) => {
      console.error('[subscription] notifyUnassigned (selection-undo webhook) threw', err);
    });
  }
}

/**
 * Fresh broadcast — triggered by SquadHub's "Broadcast to talents" after a
 * reopen. Retires the prior round's recipients (soft-cancel, keeping the
 * accepted/rejected audit rows SquadHub also archives on its side) and
 * re-fans-out to the FULL matching pool so every matching talent gets a fresh
 * offer. The new rows carry new ids, so responses flow back to SquadHub as a
 * clean new round.
 */
export async function freshBroadcast(externalCardId: string): Promise<{ matched: number }> {
  const { data: card } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, status, match_rules, content')
    .eq('external_id', externalCardId)
    .maybeSingle();
  if (!card) return { matched: 0 };
  const cid = (card as any).id as string;

  // Retire the prior round's recipients with cancelled_at rather than deleting
  // them: SquadHub keeps archived copies of the old round, so a hard delete
  // forks the two systems' histories and leaves any late talent-response
  // callback pointing at a missing row. The partial unique index
  // (`WHERE cancelled_at IS NULL`) lets the fresh round's rows insert alongside
  // the retired ones, and fanOutBroadcast dedups against non-cancelled rows
  // only, so everyone still gets a fresh ask. Selection stamps are cleared so
  // an old selected row can't resurface in My Clients once the card goes back
  // to 'active' — the same reset the selection-undo callback applies, minus
  // the dependence on that callback's timing.
  await supabaseAdmin
    .from('subscription_card_recipients')
    .update({ cancelled_at: new Date().toISOString(), selected_at: null, passed_over_at: null })
    .eq('card_id', cid)
    .is('cancelled_at', null);

  // Reset the card to a clean, receivable state before re-inviting. Talents only
  // see cards that are status='active' AND archived_at IS NULL; clear any
  // prior-round selection / activation / recall so the fresh round is clean and
  // independent of the selection-undo callback's timing.
  await supabaseAdmin
    .from('subscription_cards')
    .update({
      status: 'active',
      archived_at: null,
      recalled_at: null,
      selected_at: null,
      selected_talent_user_id: null,
      subscription_activated_at: null,
    })
    .eq('id', cid);

  const matched = await fanOutBroadcast(
    cid,
    ((card as any).match_rules ?? {}) as Record<string, unknown>,
    ((card as any).content ?? {}) as Record<string, unknown>,
  );
  return { matched };
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

// Fired when an admin unassigns a card that SquadHub had already ACTIVATED
// (a live subscription). Tells SquadHub to reverse the activation on their
// side so the two systems don't drift. Fire-and-forget like the selection
// callbacks — a no-op until SquadHub implements the `/card-activation-undo`
// handler (tracked separately).
async function deliverActivationUndoCallback(externalId: string, unassignedAt: string): Promise<void> {
  const url = env.SQUADHUB_CALLBACK_URL;
  if (!url) return;

  const activationUndoUrl = url.replace(/\/card-responses\/?$/, '/card-activation-undo');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.SQUADHUB_CALLBACK_SECRET) {
      headers['X-SquadHub-Signature'] = env.SQUADHUB_CALLBACK_SECRET;
    }
    await fetch(activationUndoUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ external_id: externalId, unassigned_at: unassignedAt }),
      signal: controller.signal,
    });
  } catch (err) {
    console.warn('[subscription] activation undo callback failed', err instanceof Error ? err.message : err);
  } finally {
    clearTimeout(timer);
  }
}
