import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';

/**
 * Outbound jobs-event delivery (Profiles → SquadHub).
 *
 * Generalizes the per-row callback pattern of squadhub-callback.service.ts to
 * N event types via the squadhub_event_outbox table (00107):
 *  - The mutating request writes an outbox row and delivers it inline ONCE.
 *  - Failures are retried by startJobsOutboxSweeper (5-min tick, batch 50,
 *    max 10 attempts — same constants as the accept/reject callback sweeper).
 *  - dedupe_key makes re-emits idempotent (e.g. 'job_offer_sent:<offer_id>');
 *    a duplicate insert is silently dropped.
 *
 * Everything posts to the SINGLE SquadHub events endpoint
 * (SQUADHUB_JOBS_EVENTS_URL) as one envelope:
 *   { event, external_id, job_profile_external_id, recipient_id,
 *     candidate_id, actor, occurred_at, data }
 * signed with the existing SQUADHUB_CALLBACK_SECRET header. If the URL is
 * unset, rows queue up and deliver once it's configured.
 */

const REQUEST_TIMEOUT_MS = 3_000;
const MAX_ATTEMPTS = 10;
const SWEEPER_INTERVAL_MS = 5 * 60 * 1_000;
const SWEEPER_BATCH_SIZE = 50;

export interface JobsEventRefs {
  external_id?: string | null;
  job_profile_external_id?: string | null;
  recipient_id?: string | null;
  candidate_id?: string | null;
  actor?: { type: string; id?: string | null } | null;
  data?: Record<string, unknown>;
}

interface AttemptOutcome {
  delivered: boolean;
  error?: string;
}

async function postOnce(envelope: Record<string, unknown>): Promise<AttemptOutcome> {
  const url = env.SQUADHUB_JOBS_EVENTS_URL;
  if (!url) {
    return { delivered: false, error: 'jobs_events_url_not_configured' };
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
 * Queue + inline-deliver one jobs event. Never throws — event delivery must
 * not fail the user-facing mutation that triggered it. A duplicate dedupe_key
 * means the event was already emitted (retry / webhook replay) → no-op.
 */
export async function emitJobsEvent(
  eventType: string,
  refs: JobsEventRefs,
  dedupeKey?: string,
): Promise<void> {
  try {
    const envelope: Record<string, unknown> = {
      event: eventType,
      external_id: refs.external_id ?? null,
      job_profile_external_id: refs.job_profile_external_id ?? null,
      recipient_id: refs.recipient_id ?? null,
      candidate_id: refs.candidate_id ?? null,
      actor: refs.actor ?? { type: 'system' },
      occurred_at: new Date().toISOString(),
      data: refs.data ?? {},
    };

    const { data: row, error } = await supabaseAdmin
      .from('squadhub_event_outbox')
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
        console.error('[jobs-outbox] failed to insert outbox row', {
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
      .from('squadhub_event_outbox')
      .update(patch)
      .eq('id', row.id);
    if (updErr) {
      console.error('[jobs-outbox] failed to persist delivery state', updErr);
    }
  } catch (err) {
    console.error('[jobs-outbox] emitJobsEvent threw', err);
  }
}

/**
 * Periodic sweeper retrying undelivered outbox rows. Bounded by
 * SWEEPER_BATCH_SIZE per tick and MAX_ATTEMPTS per row.
 */
export function startJobsOutboxSweeper(): NodeJS.Timeout {
  const tick = async () => {
    try {
      const { data: rows, error } = await supabaseAdmin
        .from('squadhub_event_outbox')
        .select('id, event_type, payload, attempts')
        .is('delivered_at', null)
        .lt('attempts', MAX_ATTEMPTS)
        .order('created_at', { ascending: true })
        .limit(SWEEPER_BATCH_SIZE);

      if (error) {
        console.error('[jobs-outbox] sweeper query failed', error);
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
          .from('squadhub_event_outbox')
          .update(patch)
          .eq('id', row.id);
        if (updErr) {
          console.error('[jobs-outbox] sweeper failed to persist state', updErr);
        }
      }
    } catch (err) {
      console.error('[jobs-outbox] sweeper tick errored', err);
    }
  };

  // Kick the first tick a few seconds after boot so startup isn't blocked.
  const handle = setInterval(tick, SWEEPER_INTERVAL_MS);
  setTimeout(tick, 15_000);
  return handle;
}
