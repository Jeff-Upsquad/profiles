import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { deliverCrmSystemEvent } from '../lib/crm-system-event.js';
import { getTalentTiersByUserIds } from './talent-tier.service.js';

/**
 * Business WhatsApp card alerts (00150).
 *
 * A business publishes a card; talents respond. This nudges the business on
 * WhatsApp so they come back and look — without turning a popular card into a
 * message-per-talent firehose.
 *
 * The cadence is deliberately driven by the business's own attention, not by a
 * timer:
 *
 *   1. First response after the card goes live  → send.
 *   2. Everything after that                    → silent; a nudge is already
 *                                                 outstanding.
 *   3. Business opens the card's review page    → the alert re-arms.
 *   4. Next new response after that             → send again.
 *
 * Repeat up to MAX_SENDS times per card per kind, then stay quiet for good.
 * `COOLDOWN_MINUTES` is a floor between two sends so a business refreshing the
 * page in a loop can't pull five messages in five minutes; hitting the floor
 * does NOT spend a send slot.
 *
 * Two kinds, because they're different asks:
 *   'acceptance' — talents accepted / candidates applied → go shortlist.
 *   'bid'        — talents named a price / candidates opened a salary
 *                  negotiation → go respond to the money.
 *
 * Delivery rides the existing business system-event channel: Profiles POSTs to
 * Squad CRM, which maps `system_event` to an approved WhatsApp template and
 * sends via Meta. An unmapped template answers `{skipped:true}`, which we treat
 * as "not delivered" and hand the send slot back — so this is safe to ship
 * before the templates are approved.
 */

export type CardAlertKind = 'acceptance' | 'bid';

/**
 * The five buckets stage 1 fires for. A business cares *who* showed up, not
 * just how many — "a Top Talent accepted" is different news from "a junior
 * accepted", and worth interrupting them for separately.
 *
 * 'other' catches the 'custom' tier and talents with no tier resolved yet, so
 * an untiered talent still produces exactly one instant alert instead of
 * silently falling into the 30-minute roll-up.
 */
export type ResponderGroup = 'top_talents' | 'pro' | 'junior' | 'other' | 'agency';

/** How each group is named inside the WhatsApp sentence. */
const GROUP_LABEL: Record<ResponderGroup, string> = {
  top_talents: 'A Top Talent',
  pro: 'A pro talent',
  junior: 'A junior talent',
  other: 'A talent',
  agency: 'An agency',
};

/** talent_profiles.tier → bucket. Anything unrecognised lands in 'other'. */
function groupForTier(tier: string | null | undefined): ResponderGroup {
  if (tier === 'Top Talents') return 'top_talents';
  if (tier === 'pro') return 'pro';
  if (tier === 'junior') return 'junior';
  return 'other';
}

async function resolveResponderGroup(params: {
  responderType?: 'talent' | 'agency';
  talentUserId?: string;
}): Promise<ResponderGroup> {
  if (params.responderType === 'agency') return 'agency';
  if (!params.talentUserId) return 'other';
  try {
    const tiers = await getTalentTiersByUserIds([params.talentUserId]);
    return groupForTier(tiers[params.talentUserId]?.tier ?? null);
  } catch (err) {
    console.error('[business-card-alerts] tier lookup failed', err);
    return 'other';
  }
}

/** Cards that behave like a talent marketplace brief (accept + priced bids). */
const MARKETPLACE_CARD_TYPES = new Set(['subscription', 'assignment']);

interface AlertCard {
  id: string;
  cardType: string;
  businessUserId: string;
  groupId: string | null;
  content: Record<string, unknown>;
}

interface AlertBusiness {
  name: string;
  phone: string;
}

/**
 * System event names. Each must match an APPROVED WhatsApp template name in the
 * Squad CRM workspace — the CRM resolves the template by name convention.
 *
 * Jobs get their own pair: "candidates applied for your job post" reads wrong
 * for a subscription brief, and vice versa.
 */
const EVENT_BY_SURFACE: Record<'marketplace' | 'jobs', Record<CardAlertKind, string>> = {
  marketplace: {
    acceptance: 'business_card_new_acceptances',
    bid: 'business_card_new_bids',
  },
  jobs: {
    acceptance: 'business_job_new_applicants',
    bid: 'business_job_new_negotiations',
  },
};

/**
 * Stage 1 speaks about a person, not a number ("A Top Talent has accepted…"),
 * so it needs its own template. Stages 2 and 3 both quote a count and reuse
 * the EVENT_BY_SURFACE templates above.
 */
const FIRST_EVENT_BY_SURFACE: Record<'marketplace' | 'jobs', string> = {
  marketplace: 'business_card_first_acceptance',
  jobs: 'business_job_first_applicant',
};

/**
 * Meta rejects template parameters containing newlines, tabs or runs of 4+
 * spaces, and caps the rendered body length. Card titles and contact names are
 * user-authored, so every value that reaches a {{n}} goes through here.
 */
function sanitizeParam(value: string, maxLength = 60): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > maxLength ? `${flat.slice(0, maxLength - 1).trimEnd()}…` : flat;
}

function cardTitle(content: Record<string, unknown>, cardType: string): string {
  if (typeof content.title === 'string' && content.title.trim()) return content.title.trim();
  const jp = content.job_profile as Record<string, unknown> | undefined;
  if (jp && typeof jp.title === 'string' && jp.title.trim()) return jp.title.trim();
  if (typeof content.brand_name === 'string' && content.brand_name.trim()) {
    return content.brand_name.trim();
  }
  if (cardType === 'hiring') return 'your job post';
  return cardType === 'assignment' ? 'your assignment' : 'your requirement';
}

/**
 * Cards published as a tier group are ONE brief to the business: the dashboard
 * lists only the non-secondary sibling, and its review screen shows every
 * tier's talents together.
 *
 * So the alert has to be keyed on the group, not the card — otherwise talents
 * accepting on two sibling tiers spend two send budgets and fire two WhatsApps
 * quoting the same count. `primaryCardId` is that shared key (and the id the
 * deep link points at, so the business lands on the card they actually see).
 */
async function resolveGroup(
  card: AlertCard,
): Promise<{ primaryCardId: string; cardIds: string[] }> {
  if (!card.groupId) return { primaryCardId: card.id, cardIds: [card.id] };
  const { data } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, is_secondary')
    .eq('group_id', card.groupId)
    .is('archived_at', null);
  const rows = data ?? [];
  if (rows.length === 0) return { primaryCardId: card.id, cardIds: [card.id] };
  const primary = rows.find((c: any) => c.is_secondary === false) ?? rows[0];
  return {
    primaryCardId: (primary as any).id as string,
    cardIds: rows.map((c: any) => c.id as string),
  };
}

async function loadCard(cardId: string): Promise<AlertCard | null> {
  const { data, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, card_type, business_user_id, group_id, content, status, archived_at')
    .eq('id', cardId)
    .maybeSingle();
  if (error || !data) return null;
  const businessUserId = (data as any).business_user_id as string | null;
  // No linked business, or the card is closed/recalled — nobody to nudge.
  if (!businessUserId) return null;
  if ((data as any).archived_at) return null;
  if ((data as any).status !== 'active') return null;
  return {
    id: (data as any).id as string,
    cardType: ((data as any).card_type as string | null) ?? 'subscription',
    businessUserId,
    groupId: ((data as any).group_id as string | null) ?? null,
    content: ((data as any).content ?? {}) as Record<string, unknown>,
  };
}

async function loadBusiness(businessUserId: string): Promise<AlertBusiness | null> {
  const { data, error } = await supabaseAdmin
    .from('business_users')
    .select(
      'contact_person_name, company_name, contact_phone, contact_phone_normalized, is_active, whatsapp_card_alerts_enabled',
    )
    .eq('id', businessUserId)
    .maybeSingle();
  if (error || !data) return null;
  if ((data as any).is_active === false) return null;
  if ((data as any).whatsapp_card_alerts_enabled === false) return null;

  // contact_phone carries the country code the business signed up with;
  // contact_phone_normalized is digits-only for login matching. The CRM
  // normalizes to E.164 itself, so prefer the richer raw value.
  const phone =
    (((data as any).contact_phone as string | null) ??
      ((data as any).contact_phone_normalized as string | null) ??
      '').trim();
  if (!phone) return null;

  const name =
    (((data as any).contact_person_name as string | null) ??
      ((data as any).company_name as string | null) ??
      '').trim();
  return { name: name || 'there', phone };
}

/**
 * How many responses are sitting unattended right now. This is what the message
 * quotes, so it has to match what the business sees when they open the card —
 * hence the same "unseen / awaiting you" filters the review screens use.
 */
async function countPending(
  kind: CardAlertKind,
  card: AlertCard,
  groupCardIds: string[],
): Promise<number> {
  if (kind === 'acceptance') {
    const { count: talentCount } = await supabaseAdmin
      .from('subscription_card_recipients')
      .select('id', { count: 'exact', head: true })
      .in('card_id', groupCardIds)
      .eq('status', 'accepted')
      .is('cancelled_at', null)
      .is('business_seen_at', null);

    // Agencies accept into their own table against the same card ids.
    const { count: agencyCount } = await supabaseAdmin
      .from('agency_card_recipients')
      .select('id', { count: 'exact', head: true })
      .in('card_id', groupCardIds)
      .eq('status', 'accepted')
      .is('cancelled_at', null)
      .is('business_seen_at', null);

    return (talentCount ?? 0) + (agencyCount ?? 0);
  }

  if (card.cardType === 'hiring') {
    // Jobs "bid" = a candidate countered the offer with their own figure.
    const { count } = await supabaseAdmin
      .from('job_offers')
      .select('id', { count: 'exact', head: true })
      .in('card_id', groupCardIds)
      .eq('status', 'negotiating');
    return count ?? 0;
  }

  const { count } = await supabaseAdmin
    .from('assignment_offers')
    .select('id', { count: 'exact', head: true })
    .in('card_id', groupCardIds)
    .eq('status', 'pending_business');
  return count ?? 0;
}

async function releaseClaim(cardId: string, kind: CardAlertKind): Promise<void> {
  const { error } = await supabaseAdmin.rpc('release_business_card_alert', {
    p_card_id: cardId,
    p_kind: kind,
  });
  if (error) {
    console.error('[business-card-alerts] release failed', { cardId, kind, error: error.message });
  }
}

/** Shared send step for stages 2 and 3, which both quote a count. */
async function sendCountMessage(params: {
  card: AlertCard;
  business: AlertBusiness;
  kind: CardAlertKind;
  primaryCardId: string;
  groupCardIds: string[];
  stage: 'rollup' | 'post_review';
}): Promise<boolean> {
  const { card, business, kind, primaryCardId, groupCardIds, stage } = params;
  const surface = card.cardType === 'hiring' ? 'jobs' : 'marketplace';
  const event = EVENT_BY_SURFACE[surface][kind];
  const title = cardTitle(card.content, card.cardType);
  const pending = Math.max(await countPending(kind, card, groupCardIds), 1);

  const delivered = await deliverCrmSystemEvent({
    audience: 'business',
    event,
    name: business.name,
    phone: business.phone,
    data: {
      business_name: business.name,
      count: String(pending),
      card_title: title,
      card_id: primaryCardId,
      stage,
    },
    bodyParams: [sanitizeParam(business.name, 40), String(pending), sanitizeParam(title)],
    buttonUrlParam: primaryCardId,
  });

  if (delivered) {
    console.info('[business-card-alerts] sent', { cardId: primaryCardId, kind, event, stage, pending });
  }
  return delivered;
}

/**
 * A talent or agency responded to a card — walk the ladder and decide whether
 * the business hears about it now, later, or not at all.
 *
 *   Stage 1  first responder from this group → send immediately.
 *   Stage 2  group already announced, roll-up still pending → stay quiet; the
 *            sweeper will fold this response into the 30-minute total.
 *   Stage 3  roll-up settled → the 00150 rule: send only if the business has
 *            reviewed the card since the last nudge.
 *
 * Fire-and-forget: never throws, never blocks the responder's own action.
 */
export async function notifyBusinessCardActivity(params: {
  cardId: string;
  kind: CardAlertKind;
  talentUserId?: string;
  responderType?: 'talent' | 'agency';
}): Promise<void> {
  const { cardId, kind } = params;
  try {
    if (params.responderType === 'agency' && !env.BUSINESS_CARD_ALERT_INCLUDE_AGENCIES) {
      // The business card review screen does not list agency acceptances yet,
      // so an "an agency accepted" nudge would land them on a page with no
      // agency on it. Counting still happens; only the alert is held back.
      return;
    }

    const card = await loadCard(cardId);
    if (!card) return;
    if (card.cardType !== 'hiring' && !MARKETPLACE_CARD_TYPES.has(card.cardType)) return;

    const business = await loadBusiness(card.businessUserId);
    if (!business) return;

    // One ladder per brief, not per tier card.
    const { primaryCardId, cardIds: groupCardIds } = await resolveGroup(card);

    // ── Stage 1 ────────────────────────────────────────────────────────────
    // Bids have no tier story — they drop straight to stage 3.
    if (kind === 'acceptance') {
      const group = await resolveResponderGroup(params);
      const { data: claim, error: claimErr } = await supabaseAdmin.rpc(
        'claim_business_card_group_alert',
        {
          p_card_id: primaryCardId,
          p_business_user_id: card.businessUserId,
          p_kind: kind,
          p_group: group,
          p_rollup_minutes: env.BUSINESS_CARD_ALERT_ROLLUP_MINUTES,
        },
      );
      if (claimErr) {
        console.error('[business-card-alerts] group claim failed', {
          cardId: primaryCardId,
          group,
          error: claimErr.message,
        });
        return;
      }
      const row = Array.isArray(claim) ? claim[0] : claim;
      const claimed = Number((row as any)?.out_claimed ?? 0) === 1;

      if (claimed) {
        const surface = card.cardType === 'hiring' ? 'jobs' : 'marketplace';
        const title = cardTitle(card.content, card.cardType);
        const delivered = await deliverCrmSystemEvent({
          audience: 'business',
          event: FIRST_EVENT_BY_SURFACE[surface],
          name: business.name,
          phone: business.phone,
          data: {
            business_name: business.name,
            responder: GROUP_LABEL[group],
            card_title: title,
            card_id: primaryCardId,
            group,
          },
          bodyParams: [
            sanitizeParam(business.name, 40),
            GROUP_LABEL[group],
            sanitizeParam(title),
          ],
          buttonUrlParam: primaryCardId,
        });
        if (!delivered) {
          await supabaseAdmin.rpc('release_business_card_group_alert', {
            p_card_id: primaryCardId,
            p_kind: kind,
            p_group: group,
          });
          return;
        }
        console.info('[business-card-alerts] stage1 sent', {
          cardId: primaryCardId,
          group,
          event: FIRST_EVENT_BY_SURFACE[surface],
        });
        return;
      }

      // Not claimed. Either this group already fired and the roll-up is still
      // pending (stay quiet — the sweeper folds this in), or the ladder has
      // moved past stage 1, in which case stage 3 below decides.
      const reason = String((row as any)?.out_reason ?? '');
      if (reason !== 'ladder_past_stage_one') return;
    }

    // ── Stage 3 ────────────────────────────────────────────────────────────
    const { data: sendClaim, error: sendErr } = await supabaseAdmin.rpc(
      'claim_business_card_alert',
      {
        p_card_id: primaryCardId,
        p_business_user_id: card.businessUserId,
        p_kind: kind,
        p_max_sends: env.BUSINESS_CARD_ALERT_MAX_SENDS,
        p_cooldown_seconds: env.BUSINESS_CARD_ALERT_COOLDOWN_MINUTES * 60,
      },
    );
    if (sendErr) {
      console.error('[business-card-alerts] claim failed', {
        cardId: primaryCardId,
        kind,
        error: sendErr.message,
      });
      return;
    }
    const sendRow = Array.isArray(sendClaim) ? sendClaim[0] : sendClaim;
    if (!Number((sendRow as any)?.out_send_number ?? 0)) {
      console.info('[business-card-alerts] skipped', {
        cardId: primaryCardId,
        kind,
        reason: (sendRow as any)?.out_reason ?? 'unknown',
      });
      return;
    }

    const delivered = await sendCountMessage({
      card,
      business,
      kind,
      primaryCardId,
      groupCardIds,
      stage: 'post_review',
    });
    if (!delivered) await releaseClaim(primaryCardId, kind);
  } catch (err) {
    console.error('[business-card-alerts] notify threw', err);
  }
}

/**
 * Stage 2. Settle every card whose 30-minute roll-up has come due: send one
 * message with the real total, but only when more responses arrived than
 * stage 1 already announced (each stage-1 message covered exactly one).
 *
 * Settling stamps rollup_sent_at either way — that is what opens stage 3.
 *
 * Driven by the per-minute sweeper so it survives restarts; an in-process
 * timer would lose every pending roll-up on deploy.
 */
export async function sweepBusinessCardRollups(): Promise<void> {
  const { data: due, error } = await supabaseAdmin
    .from('business_card_alert_state')
    .select('card_id, kind')
    .eq('kind', 'acceptance')
    .not('rollup_due_at', 'is', null)
    .is('rollup_sent_at', null)
    .lte('rollup_due_at', new Date().toISOString())
    .limit(200);
  if (error) {
    console.error('[business-card-alerts] rollup sweep query failed', error.message);
    return;
  }

  for (const rowDue of due ?? []) {
    const cardId = (rowDue as any).card_id as string;
    const kind = (rowDue as any).kind as CardAlertKind;
    try {
      const { data: claim, error: claimErr } = await supabaseAdmin.rpc(
        'claim_business_card_rollup',
        { p_card_id: cardId, p_kind: kind },
      );
      if (claimErr) {
        console.error('[business-card-alerts] rollup claim failed', cardId, claimErr.message);
        continue;
      }
      const row = Array.isArray(claim) ? claim[0] : claim;
      if (Number((row as any)?.out_claimed ?? 0) !== 1) continue;

      const announced = Number((row as any)?.out_announced ?? 0);

      const card = await loadCard(cardId);
      if (!card) continue;
      const business = await loadBusiness(card.businessUserId);
      if (!business) continue;

      const { primaryCardId, cardIds: groupCardIds } = await resolveGroup(card);
      const pending = await countPending(kind, card, groupCardIds);

      // Stage 1 announced one talent per group. Nothing new on top of that
      // means there is nothing to say — the card still advances to stage 3.
      if (pending <= announced) {
        console.info('[business-card-alerts] rollup settled, nothing new', {
          cardId,
          pending,
          announced,
        });
        continue;
      }

      await sendCountMessage({
        card,
        business,
        kind,
        primaryCardId,
        groupCardIds,
        stage: 'rollup',
      });
    } catch (err) {
      console.error('[business-card-alerts] rollup threw for card', cardId, err);
    }
  }
}

/**
 * The business opened a card's review screen — re-arm its alerts so the next
 * new response nudges them again. Covers every card in the tier group, since
 * the review screen shows them together.
 *
 * Fire-and-forget: a read path must never fail because of alert bookkeeping.
 */
export async function rearmBusinessCardAlerts(cardIds: string[]): Promise<void> {
  if (cardIds.length === 0) return;
  try {
    const { error } = await supabaseAdmin
      .from('business_card_alert_state')
      .update({ armed: true, last_seen_at: new Date().toISOString() })
      .in('card_id', cardIds)
      .eq('armed', false);
    if (error) {
      console.error('[business-card-alerts] rearm failed', error.message);
    }
  } catch (err) {
    console.error('[business-card-alerts] rearm threw', err);
  }
}
