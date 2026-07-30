import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

// Server-side proxy to squadhub-web's PUBLIC lead API (api.squadhub.in). The
// business portal is a different origin (squadhire.upsquadconnect.com) and
// squadhub's CORS only allows *.squadhub.in, so the browser can't POST there
// directly. We forward from our backend instead, mirroring the payload the
// public /connect brief form sends.

const TIMEOUT_MS = 10_000;

// Base origin of the SquadHub server API (no trailing slash). Same idiom as
// squadhub-sso / offers services: explicit API base first, then the callback
// URL's origin. The public lead endpoints (/leads/landing, /clients/countries)
// live on this same server, so no dedicated env var is needed.
function squadhubBase(): string {
  if (env.SQUADHUB_API_URL) return env.SQUADHUB_API_URL.replace(/\/$/, '');
  if (env.SQUADHUB_CALLBACK_URL) return new URL(env.SQUADHUB_CALLBACK_URL).origin;
  return '';
}

export function isConfigured(): boolean {
  return !!squadhubBase();
}

function baseUrl(): string {
  const base = squadhubBase();
  if (!base) {
    throw new AppError(503, 'Talent requests are not available right now.');
  }
  return base;
}

async function squadhubFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${baseUrl()}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, 'Could not reach the talent request service.');
  } finally {
    clearTimeout(timer);
  }
}

export interface SquadhubCountry {
  id: string;
  name: string;
  currency: string;
  sort_order: number;
}

// GET /clients/countries → { success, data: Country[] }. Returns the raw list
// so the brief form can populate its country picker.
export async function listCountries(): Promise<SquadhubCountry[]> {
  const res = await squadhubFetch('/clients/countries');
  const body = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: SquadhubCountry[] }
    | null;
  if (!res.ok || !body?.success || !Array.isArray(body.data)) {
    throw new AppError(502, 'Could not load the country list.');
  }
  return body.data;
}

// POST /leads/landing — forwards the assembled brief. The payload shape is
// validated upstream (connect-brief.validators) and matches squadhub's public
// submission schema. Returns squadhub's JSON response body on success.
export async function submitLandingBrief(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await squadhubFetch('/leads/landing', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as
    | { success?: boolean; error?: string }
    | null;
  if (!res.ok || !body?.success) {
    // Surface squadhub's own validation message where available, else generic.
    const message = body?.error || 'Could not submit your request. Please try again.';
    throw new AppError(res.status >= 400 && res.status < 500 ? 400 : 502, message);
  }
  return body as Record<string, unknown>;
}
