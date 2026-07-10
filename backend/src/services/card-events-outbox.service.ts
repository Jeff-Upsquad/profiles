import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';

/**
 * Outbound card-event delivery (Profiles → SquadHub) for the Assignments
 * offer/counter-offer negotiation.
 *
 * Deliberately separate from jobs-outbox.service.ts (which posts to
 * SQUADHUB_JOBS_EVENTS_URL): assignment offer events post to
 * SQUADHUB_CARD_EVENTS_URL via their OWN card_event_outbox table + sweeper, so
 * a card event can never be delivered to the jobs endpoint and vice versa (the
 * sync-isolation lesson from the sweeper-leak incidents).
 *
 * SquadHub reads the offer state LIVE via a signed snapshot (authoritative);
 * these events only warm its mirror cache + audit log. Envelope:
 *   { event, external_id, recipient_id, offer_id, actor, occurred_at, data }
 * signed with SQUADHUB_CALLBACK_SECRET. dedupe_key makes re-emits idempotent.
 */

const REQUEST_TIMEOUT_MS = 3_000;
const MAX_ATTEMPTS = 10;
const SWEEPER_INTERVAL_MS = 5 * 60 * 1_000;
const SWEEPER_BATCH_SIZE = 50;

export interface CardEventRefs {
  external_id?: string | null;
  recipient_id?: string | null;
  offer_id?: string | null;
  actor?: { type: string; id?: string | null } | null;
  data?: Record<string, unknown>;
}

interface AttemptOutcome {
  delivered: boolean;
  error?: string;
}

async function postOnce(envelope: Record<string, unknown>): Promise<AttemptOutcome> {
  const url = env.SQUADHUB_CARD_EVENTS_URL;
  if (!url) {
    return { delivered: false, error: 'card_events_url_not_configured' };
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
      body: JSON.stringify(envelope),
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

/**
 * Queue + inline-deliver one card event. Never throws — event delivery must not
 * fail the user-facing mutation that triggered it. A duplicate dedupe_key means
 * the event was already emitted (retry / webhook replay) → no-op.
 */
export async function emitCardEvent(
  eventType: string,
  refs: CardEventRefs,
  dedupeKey?: string,
): Promise<void> {
  // Dormant unless a SquadHub receiver is configured. The admin manages offers
  // via LIVE snapshot reads (the user's "synced, not mirrored" requirement), so
  // there is no mirror to warm by default — don't accumulate undelivered rows.
  // Setting SQUADHUB_CARD_EVENTS_URL later activates this cache-warming channel.
  if (!env.SQUADHUB_CARD_EVENTS_URL) return;
  try {
    const envelope: Record<string, unknown> = {
      event: eventType,
      external_id: refs.external_id ?? null,
      recipient_id: refs.recipient_id ?? null,
      offer_id: refs.offer_id ?? null,
      actor: refs.actor ?? { type: 'system' },
      occurred_at: new Date().toISOString(),
      data: refs.data ?? {},
    };

    const { data: row, error } = await supabaseAdmin
      .from('card_event_outbox')
      .insert({
        event_type: eventType,
        payload: envelope,
        dedupe_key: dedupeKey ?? null,
      })
      .select('id')
      .single();

    if (error) {
      // 23505 = dedupe_key already present — the event was emitted before.
      if (error.code !== '23505') {
        console.error('[card-outbox] failed to insert outbox row', {
          event: eventType,
          error: error.message,
        });
      }
      return;
    }

    const outcome = await postOnce(envelope);
    const patch: Record<string, unknown> = {
      attempts: 1,
      last_error: outcome.delivered ? null : outcome.error ?? 'unknown_error',
    };
    if (outcome.delivered) patch.delivered_at = new Date().toISOString();

    const { error: updErr } = await supabaseAdmin
      .from('card_event_outbox')
      .update(patch)
      .eq('id', row.id);
    if (updErr) {
      console.error('[card-outbox] failed to persist delivery state', updErr);
    }
  } catch (err) {
    console.error('[card-outbox] emitCardEvent threw', err);
  }
}

/**
 * Periodic sweeper retrying undelivered card-event rows. Bounded by
 * SWEEPER_BATCH_SIZE per tick and MAX_ATTEMPTS per row.
 */
export function startCardEventsOutboxSweeper(): NodeJS.Timeout {
  const tick = async () => {
    try {
      const { data: rows, error } = await supabaseAdmin
        .from('card_event_outbox')
        .select('id, event_type, payload, attempts')
        .is('delivered_at', null)
        .lt('attempts', MAX_ATTEMPTS)
        .order('created_at', { ascending: true })
        .limit(SWEEPER_BATCH_SIZE);

      if (error) {
        console.error('[card-outbox] sweeper query failed', error);
        return;
      }
      if (!rows || rows.length === 0) return;

      for (const row of rows as Array<{ id: string; payload: Record<string, unknown>; attempts: number }>) {
        const outcome = await postOnce(row.payload);
        const patch: Record<string, unknown> = {
          attempts: (row.attempts ?? 0) + 1,
          last_error: outcome.delivered ? null : outcome.error ?? 'unknown_error',
        };
        if (outcome.delivered) patch.delivered_at = new Date().toISOString();

        const { error: updErr } = await supabaseAdmin
          .from('card_event_outbox')
          .update(patch)
          .eq('id', row.id);
        if (updErr) {
          console.error('[card-outbox] sweeper failed to persist state', updErr);
        }
      }
    } catch (err) {
      console.error('[card-outbox] sweeper tick errored', err);
    }
  };

  const handle = setInterval(tick, SWEEPER_INTERVAL_MS);
  setTimeout(tick, 15_000);
  return handle;
}
