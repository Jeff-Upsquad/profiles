import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

/**
 * Server-to-server calls to SquadHub for "Sign in with SquadHub" SSO.
 *
 * SquadHub is the identity provider. Two endpoints:
 *   POST /sso/squadhire/token      — exchange a one-time code for the user's
 *                                    identity (the password never leaves SquadHub)
 *   GET  /sso/squadhire/directory  — search eligible SquadHub users for the
 *                                    admin "Import from SquadHub" picker
 *
 * Both are signed with SQUADHUB_CALLBACK_SECRET in X-SquadHub-Signature, the
 * same shared secret SquadHire already uses for its other SquadHub callbacks.
 */

const REQUEST_TIMEOUT_MS = 5_000;

export interface SquadhubIdentity {
  id: string;
  email: string;
  name: string | null;
  user_type: string;
}

export interface SquadhubDirectoryUser {
  id: string;
  email: string;
  name: string;
  user_type: string;
  partner_org: string | null;
}

/** Base origin of the SquadHub server API (no trailing slash). */
function squadhubBase(): string {
  if (env.SQUADHUB_API_URL) return env.SQUADHUB_API_URL.replace(/\/$/, '');
  if (env.SQUADHUB_CALLBACK_URL) return new URL(env.SQUADHUB_CALLBACK_URL).origin;
  return '';
}

function requireConfig(): { base: string; secret: string } {
  const base = squadhubBase();
  const secret = env.SQUADHUB_CALLBACK_SECRET;
  if (!base || !secret) {
    throw new AppError(503, 'SquadHub SSO is not configured');
  }
  return { base, secret };
}

/** Exchange a one-time SSO code for the SquadHub user's identity. Single use. */
export async function exchangeSquadhubCode(code: string): Promise<SquadhubIdentity> {
  const { base, secret } = requireConfig();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/sso/squadhire/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SquadHub-Signature': secret },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json?.user) {
      // A bad/expired code is the common case — surface as 401 to the caller.
      throw new AppError(401, json?.error || 'SquadHub sign-in failed. Please try again.');
    }
    const u = json.user;
    return {
      id: String(u.id),
      email: String(u.email).trim().toLowerCase(),
      name: u.name ?? null,
      user_type: String(u.user_type),
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, 'Could not reach SquadHub. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}

/** Search eligible SquadHub users (internal + partner-side) for the admin picker. */
export async function fetchSquadhubDirectory(search: string): Promise<SquadhubDirectoryUser[]> {
  const { base, secret } = requireConfig();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = new URL(`${base}/sso/squadhire/directory`);
    if (search) url.searchParams.set('search', search);
    const res = await fetch(url.toString(), {
      headers: { 'X-SquadHub-Signature': secret },
      signal: controller.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new AppError(502, json?.error || 'Failed to load the SquadHub directory');
    }
    return Array.isArray(json.users) ? (json.users as SquadhubDirectoryUser[]) : [];
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, 'Could not reach SquadHub. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}
