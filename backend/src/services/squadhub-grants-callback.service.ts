import { env } from '../config/env.js';

/**
 * Outbound notifications to SquadHub when a talent_access_grants row is
 * mutated on the Profiles admin side. SquadHub mirrors the grant into its
 * own profile_access_grants table so SquadHub admins (and, where created_by
 * is set, SquadHub salespeople) see the change.
 *
 * Fire-and-forget: we do not block the admin response on the round-trip,
 * and we do not retry beyond a single inline attempt. SquadHub's inbound
 * upsert is idempotent on profiles_grant_id, and its outbound sweeper will
 * eventually reconcile if anything drifts. Best-effort is fine.
 *
 * The SQUADHUB_CALLBACK_URL env points at the existing card-response
 * endpoint (`/integrations/squadhire/card-responses`); we derive the grant
 * paths off the same origin so a single env var covers both.
 */

const REQUEST_TIMEOUT_MS = 3_000;

export interface GrantUpsertPayload {
  profiles_grant_id: string;
  email: string;
  category_ids: string[];
  expires_at: string;
  revoked_at: string | null;
  notes: string | null;
  created_by_squadhub_user_id: string | null;
  action: 'create' | 'update' | 'revoke';
}

function callbackUrlFor(path: 'grant-upserts' | 'grant-deletes'): string | null {
  const base = env.SQUADHUB_CALLBACK_URL;
  if (!base) return null;
  try {
    const u = new URL(base);
    // Replace the trailing path segment (`card-responses`) with our new one.
    // SquadHub's callbacks all live under /integrations/squadhire/.
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      u.pathname = `/${path}`;
    } else {
      segments[segments.length - 1] = path;
      u.pathname = `/${segments.join('/')}`;
    }
    u.search = '';
    return u.toString();
  } catch {
    return null;
  }
}

async function postOnce(url: string, body: object): Promise<void> {
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
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[squadhub-grants-callback] http_${res.status} from ${url}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[squadhub-grants-callback] failed: ${msg.slice(0, 300)}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function notifySquadhubGrantUpsert(payload: GrantUpsertPayload): Promise<void> {
  const url = callbackUrlFor('grant-upserts');
  if (!url) {
    // Local dev or callback not configured — skip silently.
    return;
  }
  await postOnce(url, payload);
}

export async function notifySquadhubGrantDelete(profilesGrantId: string): Promise<void> {
  const url = callbackUrlFor('grant-deletes');
  if (!url) return;
  await postOnce(url, { profiles_grant_id: profilesGrantId });
}
