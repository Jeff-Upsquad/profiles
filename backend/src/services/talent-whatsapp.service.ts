// Talent-side WhatsApp notification: when a talent receives a new subscription
// card, fire an event to SquadHire CRM. The CRM admin UI ("System Automation"
// section) decides which WhatsApp template gets sent.
//
// Throttle: at most one WhatsApp per talent per 24 hours **while the talent has
// any unviewed prior card**. Once the talent opens the app and views the queue
// (recipient.viewed_at gets stamped), the next card-arrival fires immediately.

import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';

const CRM_TIMEOUT_MS = 5_000;
const THROTTLE_WINDOW_MS = 24 * 60 * 60 * 1000;

const SYSTEM_EVENT_TYPE = 'talent_subscription_card_received';

interface AutomationLogEntry {
  event_type:
    | 'talent_card_whatsapp_sent'
    | 'talent_card_whatsapp_failed'
    | 'talent_card_whatsapp_throttled'
    | 'talent_card_whatsapp_optout'
    | 'talent_card_whatsapp_skipped';
  talent_user_id: string;
  metadata?: Record<string, unknown>;
}

async function logAutomationEvent(entry: AutomationLogEntry): Promise<void> {
  try {
    await supabaseAdmin.from('automation_events').insert({
      event_type: entry.event_type,
      lead_id: null,
      talent_user_id: entry.talent_user_id,
      triggered_by: 'system',
      metadata: entry.metadata ?? {},
    });
  } catch (err) {
    console.error('[talent-whatsapp] logAutomationEvent failed:', err);
  }
}

function pickString(content: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = content[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

interface TalentRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  whatsapp_subscription_updates_enabled: boolean;
  last_subscription_whatsapp_at: string | null;
}

async function loadTalent(talentUserId: string): Promise<TalentRow | null> {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name, phone, whatsapp_subscription_updates_enabled, last_subscription_whatsapp_at')
    .eq('id', talentUserId)
    .maybeSingle();
  if (error) {
    console.error('[talent-whatsapp] loadTalent failed:', error);
    return null;
  }
  return (data as TalentRow | null) ?? null;
}

async function hasUnviewedPriorCard(talentUserId: string, currentCardId: string): Promise<boolean> {
  // Cancelled rows don't count — the partner already rescinded them, so they
  // aren't "waiting" for the talent's attention. The current card itself also
  // doesn't count: we want to know whether the talent missed an *earlier*
  // notification.
  const { count, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('talent_user_id', talentUserId)
    .is('viewed_at', null)
    .is('cancelled_at', null)
    .neq('card_id', currentCardId);
  if (error) {
    console.error('[talent-whatsapp] hasUnviewedPriorCard query failed:', error);
    // Fail-open on the throttle check would risk spamming — fail-closed.
    return true;
  }
  return (count ?? 0) > 0;
}

async function postToCrm(payload: object): Promise<{ ok: boolean; skipped?: boolean; reason?: string; error?: string }> {
  const url = env.SQUADHIRE_CRM_SYSTEM_EVENTS_URL;
  if (!url) return { ok: false, error: 'no_url' };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.SQUADHIRE_CRM_INBOUND_SECRET) {
    headers['X-SquadHire-Admin-Signature'] = process.env.SQUADHIRE_CRM_INBOUND_SECRET;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const msg = `http_${res.status}`;
      console.warn(`[talent-whatsapp] CRM webhook ${msg}`);
      return { ok: false, error: msg };
    }
    // The CRM returns 200 even when it intentionally skips the send (e.g.
    // no System Automation configured yet, or the configured template
    // isn't APPROVED). Inspect the body so we don't arm the per-talent
    // throttle for a message that didn't actually go out.
    try {
      const body = (await res.json()) as { data?: { skipped?: boolean; reason?: string } };
      if (body?.data?.skipped === true) {
        return { ok: true, skipped: true, reason: body.data.reason };
      }
    } catch {
      // Non-JSON or empty body — treat as a real send.
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[talent-whatsapp] CRM webhook failed: ${msg.slice(0, 300)}`);
    return { ok: false, error: msg.slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}

export async function notifyTalentSubscriptionCardReceived(
  talentUserId: string,
  cardId: string,
  cardContent: Record<string, unknown>,
): Promise<void> {
  if (!env.SQUADHIRE_CRM_SYSTEM_EVENTS_URL) return;

  const talent = await loadTalent(talentUserId);
  if (!talent) return;

  if (!talent.whatsapp_subscription_updates_enabled) {
    await logAutomationEvent({
      event_type: 'talent_card_whatsapp_optout',
      talent_user_id: talentUserId,
      metadata: { card_id: cardId },
    });
    return;
  }

  if (!talent.phone) {
    await logAutomationEvent({
      event_type: 'talent_card_whatsapp_skipped',
      talent_user_id: talentUserId,
      metadata: { card_id: cardId, reason: 'no_phone' },
    });
    return;
  }

  // Throttle: if the previous WhatsApp was sent within the last 24h AND the
  // talent still has any unviewed prior card, skip. Once they engage with the
  // app (viewed_at gets stamped on fetch), the next card fires right away.
  if (talent.last_subscription_whatsapp_at) {
    const lastSentMs = new Date(talent.last_subscription_whatsapp_at).getTime();
    const withinWindow = Date.now() - lastSentMs < THROTTLE_WINDOW_MS;
    if (withinWindow) {
      const stillUnviewed = await hasUnviewedPriorCard(talentUserId, cardId);
      if (stillUnviewed) {
        await logAutomationEvent({
          event_type: 'talent_card_whatsapp_throttled',
          talent_user_id: talentUserId,
          metadata: { card_id: cardId, last_sent: talent.last_subscription_whatsapp_at },
        });
        return;
      }
    }
  }

  const brandName = pickString(cardContent, 'brand_name', 'business_name', 'company_name');
  const cardTitle = pickString(cardContent, 'title', 'subscription_name', 'plan_label', 'name');

  const payload = {
    system_event: SYSTEM_EVENT_TYPE,
    talent: {
      name: talent.full_name ?? '',
      phone: talent.phone,
      email: null,
    },
    data: {
      card_id: cardId,
      card_title: cardTitle ?? '',
      business_name: brandName ?? '',
    },
    timestamp: new Date().toISOString(),
  };

  const result = await postToCrm(payload);

  if (result.ok && !result.skipped) {
    await supabaseAdmin
      .from('talent_users')
      .update({ last_subscription_whatsapp_at: new Date().toISOString() })
      .eq('id', talentUserId);
    await logAutomationEvent({
      event_type: 'talent_card_whatsapp_sent',
      talent_user_id: talentUserId,
      metadata: { card_id: cardId, card_title: cardTitle, business_name: brandName },
    });
  } else if (result.ok && result.skipped) {
    // CRM returned 200 but didn't actually dispatch (e.g. no template
    // configured for this event yet). Log it but don't arm the throttle.
    await logAutomationEvent({
      event_type: 'talent_card_whatsapp_skipped',
      talent_user_id: talentUserId,
      metadata: { card_id: cardId, reason: result.reason ?? 'crm_skipped' },
    });
  } else {
    await logAutomationEvent({
      event_type: 'talent_card_whatsapp_failed',
      talent_user_id: talentUserId,
      metadata: { card_id: cardId, error: result.error },
    });
  }
}
