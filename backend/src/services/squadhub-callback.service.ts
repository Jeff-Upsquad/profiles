import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';

/**
 * Outbound webhook delivery for talent accept/reject responses.
 *
 * Strategy:
 *  - Attempted inline when the talent responds (3 attempts, 0/2/10s backoff).
 *  - If all attempts fail, row is left with callback_delivered_at = NULL and
 *    callback_last_error populated. A setInterval sweeper (startCallbackSweeper)
 *    retries such rows every 5 minutes, up to MAX_CALLBACK_ATTEMPTS total.
 *  - If SQUADHUB_CALLBACK_URL is unset, delivery is a no-op with a logged
 *    error, so local dev doesn't need it configured.
 */

const REQUEST_TIMEOUT_MS = 3_000;
const INLINE_ATTEMPTS = 3;
const INLINE_BACKOFF_MS = [0, 2_000, 10_000];
const MAX_CALLBACK_ATTEMPTS = 10;
const SWEEPER_INTERVAL_MS = 5 * 60 * 1_000;
const SWEEPER_BATCH_SIZE = 50;

export interface CallbackPayload {
  external_id: string;
  recipient_id: string;
  talent_user_id: string;
  action: 'accept' | 'reject';
  responded_at: string;
}

interface AttemptOutcome {
  delivered: boolean;
  error?: string;
}

async function postOnce(payload: CallbackPayload): Promise<AttemptOutcome> {
  const url = env.SQUADHUB_CALLBACK_URL;
  if (!url) {
    return { delivered: false, error: 'callback_url_not_configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.SQUADHUB_CALLBACK_SECRET) {
      headers['X-SquadHub-Signature'] = env.SQUADHUB_CALLBACK_SECRET;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (res.ok) return { delivered: true };
    return { delivered: false, error: `http_${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { delivered: false, error: msg.slice(0, 500) };
  } finally {
    clearTimeout(timer);
  }
}

async function persistCallbackResult(
  recipientId: string,
  outcome: AttemptOutcome,
  attemptsDelta: number
): Promise<void> {
  const patch: Record<string, unknown> = {
    callback_attempts: 0,
    callback_last_error: outcome.delivered ? null : outcome.error ?? 'unknown_error',
  };

  if (outcome.delivered) {
    patch.callback_delivered_at = new Date().toISOString();
  }

  // We need to increment callback_attempts without fetching first. Use raw RPC
  // only if available; otherwise do a read-modify-write.
  const { data: current, error: readErr } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('callback_attempts')
    .eq('id', recipientId)
    .single();

  if (readErr) {
    console.error('[squadhub-callback] failed to read attempts', readErr);
    return;
  }

  patch.callback_attempts = (current?.callback_attempts ?? 0) + attemptsDelta;

  const { error: updErr } = await supabaseAdmin
    .from('subscription_card_recipients')
    .update(patch)
    .eq('id', recipientId);

  if (updErr) {
    console.error('[squadhub-callback] failed to persist callback state', updErr);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Try to deliver inline with bounded retries. Returns silently — never throws,
 * never blocks the user response longer than the retry budget.
 */
export async function deliverCallback(payload: CallbackPayload): Promise<void> {
  let lastOutcome: AttemptOutcome = { delivered: false, error: 'not_attempted' };

  for (let i = 0; i < INLINE_ATTEMPTS; i++) {
    if (INLINE_BACKOFF_MS[i] > 0) await sleep(INLINE_BACKOFF_MS[i]);
    lastOutcome = await postOnce(payload);
    if (lastOutcome.delivered) break;
  }

  await persistCallbackResult(payload.recipient_id, lastOutcome, INLINE_ATTEMPTS);
}

/**
 * Periodic sweeper that retries rows where the user has responded but the
 * callback has not yet been delivered. Bounded by SWEEPER_BATCH_SIZE per tick
 * and MAX_CALLBACK_ATTEMPTS per row.
 */
export function startCallbackSweeper(): NodeJS.Timeout {
  const tick = async () => {
    try {
      const { data: rows, error } = await supabaseAdmin
        .from('subscription_card_recipients')
        .select('id, talent_user_id, status, responded_at, callback_attempts, subscription_cards!inner(external_id)')
        .neq('status', 'pending')
        .is('callback_delivered_at', null)
        .lt('callback_attempts', MAX_CALLBACK_ATTEMPTS)
        .order('updated_at', { ascending: true })
        .limit(SWEEPER_BATCH_SIZE);

      if (error) {
        console.error('[squadhub-callback] sweeper query failed', error);
        return;
      }
      if (!rows || rows.length === 0) return;

      for (const row of rows as any[]) {
        const payload: CallbackPayload = {
          external_id: row.subscription_cards.external_id,
          recipient_id: row.id,
          talent_user_id: row.talent_user_id,
          action: row.status === 'accepted' ? 'accept' : 'reject',
          responded_at: row.responded_at,
        };
        const outcome = await postOnce(payload);
        await persistCallbackResult(row.id, outcome, 1);
      }
    } catch (err) {
      console.error('[squadhub-callback] sweeper tick errored', err);
    }
  };

  // Kick the first tick a few seconds after boot so startup isn't blocked.
  const handle = setInterval(tick, SWEEPER_INTERVAL_MS);
  setTimeout(tick, 15_000);
  return handle;
}
