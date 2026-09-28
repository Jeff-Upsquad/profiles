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

export interface HubDoubt {
  id: string;
  event_id: string;
  status: 'open' | 'instructed' | 'executing' | 'taken_over' | 'completed' | 'failed';
  instruction: string | null;
  execution_token: string | null;
  resolved_by: string | null;
}

export function hubDoubtsConnected(): boolean {
  return !!hubRequest('doubts');
}

async function hubJson<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const req = hubRequest(path);
  if (!req) throw new Error('SquadHub bot key is not configured');
  const response = await fetch(req.url, {
    method,
    headers: req.headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await response.json() as { data?: T; error?: string };
  if (!response.ok || json.data === undefined) throw new Error(json.error ?? `SquadHub http_${response.status}`);
  return json.data;
}

export async function publishHubDoubt(body: {
  event_id: string;
  question: string;
  context: string;
  source_url: string;
  job_id?: string;
  target: { audience: 'candidates'; person_id?: string };
}): Promise<HubDoubt> {
  return hubJson<HubDoubt>('doubts', 'POST', body);
}

export async function pendingHubDoubts(page: number): Promise<HubDoubt[]> {
  return hubJson<HubDoubt[]>(`doubts?status=instructed&page=${page}`);
}

export async function claimHubDoubt(id: string): Promise<HubDoubt | null> {
  try {
    return await hubJson<HubDoubt>(`doubts/${id}/claim`, 'POST', {});
  } catch (error) {
    // Another worker, a takeover, or a paused bot can leave this queued.
    if (/already claimed|awaiting guidance|current mode|job is paused|outside its scope/i.test(String(error))) return null;
    throw error;
  }
}

export async function reportHubDoubtOutcome(id: string, token: string, status: 'completed' | 'failed', note: string): Promise<void> {
  await hubJson<HubDoubt>(`doubts/${id}/outcome`, 'POST', { execution_token: token, status, note });
}

export interface HubLearning { id: string; question: string; instruction: string; created_at: string }
let learningsCache: { at: number; rows: HubLearning[] } | null = null;
/** Recent human guidance augments SquadHire's own Knowledge Center. */
export async function hubLearnings(): Promise<HubLearning[]> {
  if (!hubDoubtsConnected()) return [];
  if (learningsCache && Date.now() - learningsCache.at < 60_000) return learningsCache.rows;
  try {
    const recent: HubLearning[] = [];
    // SquadHub pages oldest first. Read through to the newest guidance while
    // retaining only a bounded prompt-sized tail in memory.
    for (let page = 0; page < 100; page++) {
      const rows = await hubJson<HubLearning[]>(`learnings?page=${page}`);
      recent.push(...rows);
      if (recent.length > 50) recent.splice(0, recent.length - 50);
      if (rows.length < 100) break;
    }
    learningsCache = { at: Date.now(), rows: recent };
    return learningsCache.rows;
  } catch (error) {
    console.error('[squad-bot] SquadHub learnings unavailable:', (error as Error).message);
    return learningsCache?.rows ?? [];
  }
}
