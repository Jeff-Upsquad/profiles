// Squad Hiring Bot ↔ SquadHub admin.
//
// SquadHub admin (Squad Bots) turns the bot on or off, picks its model and can
// add instructions. We read those settings with the bot's own key
// (SQUADHUB_BOT_KEY) and report each Claude call back so SquadHub shows the
// bot's activity. The bot keeps calling Claude itself: it needs Claude-only
// tools (hand off, web fetch) that SquadHub's plain reply API doesn't carry.
//
// Without SQUADHUB_BOT_KEY nothing changes: the bot runs on this app's own
// settings, as before. If SquadHub can't be reached we keep the last settings
// we saw (or this app's own settings if we never got any).

import { env } from '../config/env.js';
import type { HubBotConfig, HubStatus } from '../lib/squadhub-bot.js';

const CACHE_MS = 30_000;
const TIMEOUT_MS = 5_000;

let cached: { at: number; config: HubBotConfig } | null = null;
let lastKnown: HubBotConfig | null = null;

function squadhubBaseUrl(): string | null {
  if (env.SQUADHUB_API_URL) return env.SQUADHUB_API_URL.replace(/\/$/, '');
  if (env.SQUADHUB_CALLBACK_URL) return new URL(env.SQUADHUB_CALLBACK_URL).origin;
  return null;
}

function hubRequest(path: string): { url: string; headers: Record<string, string> } | null {
  const base = squadhubBaseUrl();
  if (!base || !env.SQUADHUB_BOT_KEY) return null;
  return {
    url: `${base}/integrations/squad-bots/${path}`,
    headers: { Authorization: `Bearer ${env.SQUADHUB_BOT_KEY}`, 'Content-Type': 'application/json' },
  };
}

/** The bot's settings in SquadHub admin, or null when SquadHub isn't connected. */
export async function hubBotConfig(): Promise<HubBotConfig | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.config;
  const req = hubRequest('config');
  if (!req) return null;
  try {
    const res = await fetch(req.url, { headers: req.headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`http_${res.status}`);
    const body = (await res.json()) as { data?: HubBotConfig };
    if (!body.data?.status) throw new Error('bad response');
    cached = { at: Date.now(), config: body.data };
    lastKnown = body.data;
    return body.data;
  } catch (err) {
    console.error('[squad-bot] SquadHub settings unavailable:', (err as Error)?.message ?? err);
    // Don't hammer SquadHub while it's down: reuse the last answer for a cycle.
    if (lastKnown) cached = { at: Date.now(), config: lastKnown };
    return lastKnown;
  }
}

export async function hubStatus(): Promise<HubStatus | null> {
  return (await hubBotConfig())?.status ?? null;
}

/** Record a Claude call in SquadHub's activity log. Fire-and-forget. */
export function reportUsage(u: {
  ok: boolean;
  status?: HubStatus | null;
  model?: string | null;
  error?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  latency_ms?: number | null;
}): void {
  const req = hubRequest('usage');
  if (!req) return;
  const { status, ...rest } = u;
  void fetch(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ ...rest, ...(status ? { status } : {}), provider: 'claude' }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch((err) => console.error('[squad-bot] usage report failed:', (err as Error)?.message ?? err));
}
