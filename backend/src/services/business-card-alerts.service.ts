import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { deliverCrmSystemEvent } from '../lib/crm-system-event.js';

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
    const { count } = await supabaseAdmin
      .from('subscription_card_recipients')
      .select('id', { count: 'exact', head: true })
      .in('card_id', groupCardIds)
      .eq('status', 'accepted')
      .is('cancelled_at', null)
      .is('business_seen_at', null);
    return count ?? 0;
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

/**
 * A talent responded to a card — nudge the business if it's their turn to hear
 * about it. Fire-and-forget: never throws, never blocks the talent's action.
 */
export async function notifyBusinessCardActivity(params: {
  cardId: string;
  kind: CardAlertKind;
}): Promise<void> {
  const { cardId, kind } = params;
  try {
    const card = await loadCard(cardId);
    if (!card) return;
    if (card.cardType !== 'hiring' && !MARKETPLACE_CARD_TYPES.has(card.cardType)) return;

    const business = await loadBusiness(card.businessUserId);
    if (!business) return;

    // One budget per brief, not per tier card.
    const { primaryCardId, cardIds: groupCardIds } = await resolveGroup(card);

    // Claim BEFORE counting: the claim is what collapses a burst of concurrent
    // acceptances into one message.
    const { data: claim, error: claimErr } = await supabaseAdmin.rpc('claim_business_card_alert', {
      p_card_id: primaryCardId,
      p_business_user_id: card.businessUserId,
      p_kind: kind,
      p_max_sends: env.BUSINESS_CARD_ALERT_MAX_SENDS,
      p_cooldown_seconds: env.BUSINESS_CARD_ALERT_COOLDOWN_MINUTES * 60,
    });
    if (claimErr) {
      console.error('[business-card-alerts] claim failed', {
        cardId,
        kind,
        error: claimErr.message,
      });
      return;
    }
    const row = Array.isArray(claim) ? claim[0] : claim;
    const sendNumber = Number((row as any)?.out_send_number ?? 0);
    if (!sendNumber) {
      console.info('[business-card-alerts] skipped', {
        cardId,
        kind,
        reason: (row as any)?.out_reason ?? 'unknown',
      });
      return;
    }

    // The triggering response is guaranteed to be one of these, but a row the
    // count filters out (already seen, already settled) shouldn't produce a
    // "0 talents" message.
    const pending = Math.max(await countPending(kind, card, groupCardIds), 1);

    const surface = card.cardType === 'hiring' ? 'jobs' : 'marketplace';
    const event = EVENT_BY_SURFACE[surface][kind];
    const title = cardTitle(card.content, card.cardType);

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
        send_number: sendNumber,
      },
      // Explicit ordering — the CRM fills {{1}},{{2}},{{3}} from this array
      // rather than guessing at `data` key order.
      bodyParams: [sanitizeParam(business.name, 40), String(pending), sanitizeParam(title)],
      // Dynamic URL button → /business/card/<id>, which resolves the card type
      // and forwards to the right review screen.
      buttonUrlParam: primaryCardId,
    });

    if (!delivered) {
      // Template not approved yet, or Meta/transport failed. Give the slot back
      // so the next response still gets its nudge.
      await releaseClaim(primaryCardId, kind);
      return;
    }

    console.info('[business-card-alerts] sent', {
      cardId: primaryCardId,
      kind,
      event,
      sendNumber,
      pending,
    });
  } catch (err) {
    console.error('[business-card-alerts] notify threw', err);
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
