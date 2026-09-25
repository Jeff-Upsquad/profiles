import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';

/**
 * Mirror a talent push into SquadHub so the SquadHub partner app delivers it.
 *
 * Talents who sign in to the partner app use its Discover surface (this app's
 * web UI in a WebView), but our FCM tokens live in `push_tokens` under the
 * SquadHire Firebase project and only reach the retired talent app. SquadHub
 * writes an inbox row per talent it knows by email and FCMs the partner app.
 * Talents without a SquadHub account are skipped on that side.
 *
 * Fire-and-forget: never throws, never delays the caller's own push.
 */
export interface SquadHubTalentPush {
  type: string;
  title: string;
  body: string;
  card_id: string;
  route: string;
  /** 'shortlist' | 'selection' → the partner app's confirm/decline alert. */
  notification_kind?: 'shortlist' | 'selection';
  /** Known recipient row (else looked up per talent for shortlist/selection). */
  recipient_id?: string;
  business_name?: string;
  card_title?: string;
}

const MAX_TALENTS_PER_CALL = 200;
const EMAIL_LOOKUP_CONCURRENCY = 10;

function squadHubApiBase(): string {
  if (env.SQUADHUB_API_URL) return env.SQUADHUB_API_URL.replace(/\/$/, '');
  if (env.SQUADHUB_CALLBACK_URL) return new URL(env.SQUADHUB_CALLBACK_URL).origin;
  return '';
}

async function emailsFor(userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < userIds.length; i += EMAIL_LOOKUP_CONCURRENCY) {
    await Promise.all(userIds.slice(i, i + EMAIL_LOOKUP_CONCURRENCY).map(async (id) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
      const email = (data.user?.email ?? '').trim().toLowerCase();
      if (!error && email) out.set(id, email);
    }));
  }
  return out;
}

async function recipientIdsFor(cardId: string, userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!cardId) return out;
  const { data } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, talent_user_id')
    .eq('card_id', cardId)
    .is('cancelled_at', null)
    .in('talent_user_id', userIds);
  for (const r of data ?? []) out.set((r as any).talent_user_id as string, (r as any).id as string);
  return out;
}

async function cardTypeFor(cardId: string): Promise<string | null> {
  if (!cardId) return null;
  const { data } = await supabaseAdmin
    .from('subscription_cards')
    .select('card_type')
    .eq('id', cardId)
    .maybeSingle();
  return ((data as any)?.card_type as string | null) ?? null;
}

async function forward(userIds: string[], push: SquadHubTalentPush): Promise<void> {
  const base = squadHubApiBase();
  const secret = env.SQUADHUB_CALLBACK_SECRET;
  if (!base || !secret) return;
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return;

  const [emails, recipients, cardType] = await Promise.all([
    emailsFor(ids),
    push.notification_kind && !push.recipient_id
      ? recipientIdsFor(push.card_id, ids)
      : Promise.resolve(new Map<string, string>()),
    cardTypeFor(push.card_id),
  ]);
  const talents = ids.flatMap((id) => {
    const email = emails.get(id);
    if (!email) return [];
    return [{ email, recipient_id: push.recipient_id ?? recipients.get(id) ?? null }];
  });

  for (let i = 0; i < talents.length; i += MAX_TALENTS_PER_CALL) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(`${base}/integrations/squadhire/talent/push-notice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-SquadHub-Signature': secret },
        body: JSON.stringify({
          type: push.type,
          title: push.title,
          body: push.body,
          route: push.route,
          card_id: push.card_id || null,
          card_type: cardType,
          notification_kind: push.notification_kind ?? null,
          business_name: push.business_name ?? null,
          card_title: push.card_title ?? null,
          talents: talents.slice(i, i + MAX_TALENTS_PER_CALL),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[squadhub-partner-push] HTTP ${res.status}`, text.slice(0, 300));
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

export function forwardTalentPushToSquadHub(userIds: string[], push: SquadHubTalentPush): void {
  forward(userIds, push).catch((err) => console.error('[squadhub-partner-push] failed', err));
}
