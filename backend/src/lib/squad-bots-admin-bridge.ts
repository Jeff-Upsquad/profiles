import { createHmac, timingSafeEqual } from 'crypto';
import type { ModulePermission } from '../../../shared/src/types/access.js';

// Squad Bots → SquadHire admin bridge. A Squad Bots administrator asks a
// Squadbot to work in the onboarding/exception modules; Squad Bots signs each
// call with the shared secret and the administrator's email, and this app
// re-checks that the person holds the module permission before acting as them.
// See docs/squad-bots-admin-bridge.md.

export const BRIDGE_HEADERS = {
  actor: 'x-squadbots-actor',
  time: 'x-squadbots-time',
  nonce: 'x-squadbots-nonce',
  signature: 'x-squadbots-signature',
} as const;

const MAX_SKEW_MS = 5 * 60 * 1000;

export interface SignedRequest {
  actor?: string;
  time?: string;
  nonce?: string;
  signature?: string;
  method: string;
  path: string;
  body: unknown;
}

/** Same payload Squad Bots signs in server/src/chatConnections.ts. */
export function bridgePayload(r: { time: string; nonce: string; actor: string; method: string; path: string; body: unknown }) {
  return [r.time, r.nonce, r.actor.toLowerCase(), r.method, r.path, JSON.stringify(r.body ?? null)].join('\n');
}

export function signBridge(secret: string, r: Parameters<typeof bridgePayload>[0]) {
  return createHmac('sha256', secret).update(bridgePayload(r)).digest('hex');
}

/** Returns the verified actor email, or an error message. Replays are rejected by the caller's nonce store. */
export function verifyBridge(secret: string, r: SignedRequest, now = Date.now()): { actor: string } | { error: string } {
  if (!r.actor || !r.time || !r.nonce || !r.signature) return { error: 'Missing Squad Bots signature' };
  const time = Number(r.time);
  if (!Number.isFinite(time) || Math.abs(now - time) > MAX_SKEW_MS) return { error: 'Squad Bots signature expired' };
  if (!/^[0-9a-f-]{16,64}$/i.test(r.nonce)) return { error: 'Invalid Squad Bots nonce' };
  const expected = Buffer.from(signBridge(secret, { time: r.time, nonce: r.nonce, actor: r.actor, method: r.method, path: r.path, body: r.body }));
  const provided = Buffer.from(r.signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return { error: 'Invalid Squad Bots signature' };
  return { actor: r.actor.toLowerCase() };
}

/** In-memory replay guard; entries live as long as a signature could be valid. */
export function nonceStore(windowMs = 2 * MAX_SKEW_MS) {
  const seen = new Map<string, number>();
  return (nonce: string, now = Date.now()) => {
    for (const [key, at] of seen) if (now - at > windowMs) seen.delete(key);
    if (seen.has(nonce)) return false;
    seen.set(nonce, now);
    return true;
  };
}

/** Admin module each operation belongs to, and the tier the admin needs there. */
export const BRIDGE_OPERATIONS = {
  // Reads
  queue: { module: 'approvals', level: 'view' },
  talent: { module: 'approvals', level: 'view' },
  stages: { module: 'approvals', level: 'view' },
  blocked: { module: 'talents', level: 'view' },
  // Partner Program Onboarding
  approve_partner: { module: 'approvals', level: 'edit' },
  reject_partner: { module: 'approvals', level: 'edit' },
  set_partner_stage: { module: 'approvals', level: 'edit' },
  // Jobs Onboarding
  reject_jobs: { module: 'approvals', level: 'edit' },
  reinstate_jobs: { module: 'approvals', level: 'edit' },
  set_jobs_stage: { module: 'approvals', level: 'edit' },
  // Both onboarding modules (post-live talent board + webinar checklist)
  set_board_stage: { module: 'approvals', level: 'edit' },
  set_webinar_attended: { module: 'approvals', level: 'edit' },
  // Rejected / Disqualified, Cancelled Applicants
  restore_rejected: { module: 'approvals', level: 'edit' },
  restore_cancelled: { module: 'approvals', level: 'edit' },
  // Blocked Users
  block_user: { module: 'talents', level: 'edit' },
  unblock_user: { module: 'talents', level: 'edit' },
} as const satisfies Record<string, { module: string; level: ModulePermission }>;
export type BridgeOperation = keyof typeof BRIDGE_OPERATIONS;

/** Funnel stages an admin may set by hand (matches admin.service VALID_PIPELINE_STAGES minus the retired alias). */
export const MANUAL_STAGES = [
  'applicants', 'application_approved', 'onboarding_course', 'basic_profile',
  'job_profile', 'final_review', 'live', 'no_response',
] as const;
