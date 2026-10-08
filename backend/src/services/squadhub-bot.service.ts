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
import { chooseSquadbot, type HubBotConfig, type HubStatus, type Squadbot, type SquadbotBriefing } from '../lib/squadhub-bot.js';

const CACHE_MS = 30_000;
const TIMEOUT_MS = 5_000;

// Settings per Squadbot ('' is the bot itself).
const configCache = new Map<string, { at: number; config: HubBotConfig }>();
const lastKnownConfig = new Map<string, HubBotConfig>();

function squadhubBaseUrl(): string | null {
  if (env.SQUADHUB_API_URL) return env.SQUADHUB_API_URL.replace(/\/$/, '');
  if (env.SQUADHUB_CALLBACK_URL) return new URL(env.SQUADHUB_CALLBACK_URL).origin;
  return null;
}

/** Squad Bots' own API when configured, else the copy SquadHub serves. */
function integrationBaseUrl(): string | null {
  if (env.SQUAD_BOTS_API_URL) return env.SQUAD_BOTS_API_URL.replace(/\/$/, '');
  const hub = squadhubBaseUrl();
  return hub ? `${hub}/integrations/squad-bots` : null;
}

function hubRequest(path: string): { url: string; headers: Record<string, string> } | null {
  const base = integrationBaseUrl();
  if (!base || !env.SQUADHUB_BOT_KEY) return null;
  return {
    url: `${base}/${path}`,
    headers: { Authorization: `Bearer ${env.SQUADHUB_BOT_KEY}`, 'Content-Type': 'application/json' },
  };
}

/**
 * The bot's settings, or null when Squad Bots isn't connected. With a Squadbot,
 * its identity, role, persona and AI model are layered on. A paused or removed
 * Squadbot returns null so the caller falls back to another.
 */
export async function hubBotConfig(squadbotId?: string | null): Promise<HubBotConfig | null> {
  const key = squadbotId ?? '';
  const hit = configCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.config;
  const req = hubRequest(key ? `config?character_id=${encodeURIComponent(key)}` : 'config');
  if (!req) return null;
  try {
    const res = await fetch(req.url, { headers: req.headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (key && res.status >= 400 && res.status < 500 && res.status !== 429) { lastKnownConfig.delete(key); return null; }
    if (!res.ok) throw new Error(`http_${res.status}`);
    const body = (await res.json()) as { data?: HubBotConfig };
    if (!body.data?.status) throw new Error('bad response');
    configCache.set(key, { at: Date.now(), config: body.data });
    lastKnownConfig.set(key, body.data);
    return body.data;
  } catch (err) {
    console.error('[squad-bot] Squad Bots settings unavailable:', (err as Error)?.message ?? err);
    // Don't hammer Squad Bots while it's down: reuse the last answer for a cycle.
    const last = lastKnownConfig.get(key) ?? null;
    if (last) configCache.set(key, { at: Date.now(), config: last });
    return last;
  }
}

let squadbotsCache: { at: number; list: Squadbot[] } | null = null;
/** The Squadbot who starts a chat, or null to answer as plain Squad Bot. */
export async function homeSquadbot(): Promise<Squadbot | null> {
  if (!squadbotsCache || Date.now() - squadbotsCache.at >= CACHE_MS * 10) {
    try {
      squadbotsCache = { at: Date.now(), list: await hubJson<Squadbot[]>('characters') };
    } catch (err) {
      console.error('[squad-bot] Squadbots unavailable:', (err as Error)?.message ?? err);
      if (!squadbotsCache) return null;
      squadbotsCache.at = Date.now();
    }
  }
  return chooseSquadbot(squadbotsCache.list, env.SQUAD_HIRING_BOT_SQUADBOT_ID);
}

const briefingCache = new Map<string, { at: number; briefing: SquadbotBriefing }>();
/**
 * A Squadbot's memory, the confidentiality guideline and its teammates. Talents
 * are outside people, so internal-only memory never comes back. Null only when
 * Squad Bots has never been reachable; the bot then hands off beyond greetings.
 */
export async function squadbotBriefing(squadbotId: string | null): Promise<SquadbotBriefing | null> {
  const key = squadbotId ?? '';
  const hit = briefingCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS * 2) return hit.briefing;
  try {
    const briefing = await hubJson<SquadbotBriefing>(key ? `briefing?character_id=${encodeURIComponent(key)}` : 'briefing');
    briefingCache.set(key, { at: Date.now(), briefing });
    return briefing;
  } catch (err) {
    console.error('[squad-bot] Squad Bots memory unavailable:', (err as Error)?.message ?? err);
    if (hit) { hit.at = Date.now(); return hit.briefing; }
    return null;
  }
}

/** Record in Squad Bots that one Squadbot passed the chat to a teammate. */
export async function transferInSquadBots(botsConversationId: string, fromId: string, toId: string, reason: string) {
  return hubJson<{ active_character_id: string; name: string }>(
    `conversations/${botsConversationId}/transfer`, 'POST',
    { from_character_id: fromId, to_character_id: toId, reason: reason.slice(0, 300) },
  );
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

export async function hubJson<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
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
