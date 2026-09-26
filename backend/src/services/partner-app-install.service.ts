import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

/**
 * SquadHub Partner app install tracking. SquadHub owns the data (the app checks
 * in there on every signed-in launch); we pull it, match rows to our talents by
 * email and keep `partner_app_installs` so the admin Partner App page and the
 * Onboarding Hub's "Partner app downloaded" tick read locally.
 */

const REQUEST_TIMEOUT_MS = 10_000;
const SYNC_INTERVAL_MS = 10 * 60_000;
const EMAIL_BATCH = 200;
const ID_BATCH = 200;

interface RemoteInstall {
  squadhub_user_id: string;
  email: string;
  platform: 'android' | 'ios';
  version_name: string | null;
  version_code: number | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface PartnerAppRelease {
  version_code: number;
  version_name: string;
}

/** The build SquadHub's in-app updater offered at the last successful sync. */
let latestRelease: PartnerAppRelease | null = null;
let inFlight: Promise<void> | null = null;

function squadhubBase(): string {
  if (env.SQUADHUB_API_URL) return env.SQUADHUB_API_URL.replace(/\/$/, '');
  if (env.SQUADHUB_CALLBACK_URL) return new URL(env.SQUADHUB_CALLBACK_URL).origin;
  return '';
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchRemoteInstalls(): Promise<{ installs: RemoteInstall[]; latest: PartnerAppRelease | null }> {
  const base = squadhubBase();
  const secret = env.SQUADHUB_CALLBACK_SECRET;
  if (!base || !secret) throw new AppError(503, 'SquadHub partner app sync is not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/integrations/squadhire/partner-app/installs`, {
      headers: { 'X-SquadHub-Signature': secret },
      signal: controller.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success || !Array.isArray(json?.data?.installs)) {
      throw new AppError(502, json?.error || `SquadHub partner app installs failed (${res.status})`);
    }
    // version_code 1 is SquadHub's placeholder when its manifest is missing.
    const latest = json.data.latest;
    return {
      installs: json.data.installs as RemoteInstall[],
      latest: latest && Number.isInteger(latest.version_code) && latest.version_code > 1 ? latest : null,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, 'Could not reach SquadHub for partner app installs');
  } finally {
    clearTimeout(timer);
  }
}

async function syncOnce(): Promise<void> {
  const { installs, latest } = await fetchRemoteInstalls();
  latestRelease = latest;

  const byEmail = new Map<string, RemoteInstall>();
  for (const i of installs) {
    const email = i.email?.trim().toLowerCase();
    if (email) byEmail.set(email, i);
  }
  if (byEmail.size === 0) return;

  // email -> SquadHire auth user id
  const userIdByEmail = new Map<string, string>();
  for (const batch of chunk([...byEmail.keys()], EMAIL_BATCH)) {
    const { data, error } = await supabaseAdmin.rpc('get_auth_users_by_emails', { email_list: batch });
    if (error) throw new AppError(500, error.message);
    for (const row of (data ?? []) as { id: string; email: string }[]) {
      userIdByEmail.set(row.email.toLowerCase(), row.id);
    }
  }

  // Keep only accounts that are talents.
  const talentIds = new Set<string>();
  for (const batch of chunk([...new Set(userIdByEmail.values())], ID_BATCH)) {
    const { data, error } = await supabaseAdmin.from('talent_users').select('id').in('id', batch);
    if (error) throw new AppError(500, error.message);
    for (const row of data ?? []) talentIds.add((row as { id: string }).id);
  }

  const now = new Date().toISOString();
  const rows = [];
  for (const [email, i] of byEmail) {
    const talentId = userIdByEmail.get(email);
    if (!talentId || !talentIds.has(talentId)) continue;
    rows.push({
      talent_user_id: talentId,
      squadhub_user_id: i.squadhub_user_id,
      platform: i.platform,
      version_name: i.version_name,
      version_code: i.version_code,
      first_seen_at: i.first_seen_at,
      last_seen_at: i.last_seen_at,
      synced_at: now,
    });
  }
  for (const batch of chunk(rows, ID_BATCH)) {
    const { error } = await supabaseAdmin
      .from('partner_app_installs')
      .upsert(batch, { onConflict: 'talent_user_id' });
    if (error) throw new AppError(500, error.message);
  }
}

/** Pull SquadHub's partner app installs into `partner_app_installs`. Concurrent
 *  callers share one in-flight sync. */
export function syncPartnerAppInstalls(): Promise<void> {
  if (!inFlight) inFlight = syncOnce().finally(() => { inFlight = null; });
  return inFlight;
}

export function startPartnerAppInstallSync(): NodeJS.Timeout {
  const tick = async () => {
    try {
      await syncPartnerAppInstalls();
    } catch (e) {
      console.error('[partner app sync] tick failed:', (e as Error).message);
    }
  };
  const handle = setInterval(tick, SYNC_INTERVAL_MS);
  setTimeout(tick, 30_000);
  return handle;
}

/**
 * Admin Partner App page: every talent with the partner app, most recently
 * active first. Syncs first so the page is current; if SquadHub is unreachable
 * it still serves the last synced rows.
 */
export async function listInstalls() {
  try {
    await syncPartnerAppInstalls();
  } catch (e) {
    console.error('[partner app sync] on-demand sync failed:', (e as Error).message);
  }

  const { data, error } = await supabaseAdmin
    .from('partner_app_installs')
    .select('talent_user_id, version_name, version_code, platform, first_seen_at, last_seen_at, talent_users(full_name, phone)')
    .order('last_seen_at', { ascending: false });
  if (error) throw new AppError(500, error.message);

  const installs = (data ?? []).map((row: any) => ({
    user_id: row.talent_user_id,
    full_name: row.talent_users?.full_name ?? null,
    phone: row.talent_users?.phone ?? null,
    version_name: row.version_name,
    version_code: row.version_code,
    platform: row.platform,
    first_seen_at: row.first_seen_at,
    last_seen_at: row.last_seen_at,
  }));
  return { installs, latest: latestRelease };
}
