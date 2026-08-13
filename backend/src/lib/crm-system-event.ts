// Deliver a one-shot "system event" WhatsApp notification through the right CRM.
//
// Routing rule (set by product): BUSINESS-facing codes/notifications go through
// the original Squad CRM (crm.squadhub.in); TALENT-facing ones go through the
// SquadHire CRM (shcrm.squadhub.in). The CRM on the receiving end maps the
// `system_event` to an approved WhatsApp template and sends it via Meta.
//
// The CRM contract mirrors the existing SquadHire system-events webhook:
//   POST { system_event, talent:{name,phone,email}, data, timestamp }
//   → 200 { data: { skipped: true } } means "accepted but not delivered"
//     (no approved template mapped yet); anything else 2xx counts as delivered.
//
// Business fallback: if SQUADCRM_SYSTEM_EVENTS_URL is unset we fall back to the
// SquadHire CRM URL so nothing stops delivering while SquadCRM is being set up.

import { env } from '../config/env.js';

const CRM_TIMEOUT_MS = 5_000;

type Audience = 'business' | 'talent';

interface CrmTarget {
  url: string;
  headers: Record<string, string>;
}

// Resolve which CRM URL + auth header to use for this audience.
function resolveTarget(audience: Audience): CrmTarget | null {
  if (audience === 'business') {
    const url = env.SQUADCRM_SYSTEM_EVENTS_URL;
    if (url) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (env.SQUADCRM_PROVISION_SECRET) {
        headers['X-SquadCRM-Signature'] = env.SQUADCRM_PROVISION_SECRET;
      }
      return { url, headers };
    }
    // Fall back to the SquadHire CRM so business delivery doesn't regress while
    // the SquadCRM receiver is being configured.
  }

  const url = env.SQUADHIRE_CRM_SYSTEM_EVENTS_URL;
  if (!url) return null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.SQUADHIRE_CRM_INBOUND_SECRET) {
    headers['X-SquadHire-Admin-Signature'] = process.env.SQUADHIRE_CRM_INBOUND_SECRET;
  }
  return { url, headers };
}

/**
 * Fire a CRM system event. Returns true only when the CRM confirms an actual
 * WhatsApp send (not a `{skipped:true}` "no template mapped" response, and not a
 * transport error). Never throws — delivery is best-effort.
 */
export async function deliverCrmSystemEvent(args: {
  audience: Audience;
  event: string;
  name: string | null;
  phone: string;
  // Extra template variables (e.g. { code } or { temp_password }).
  data: Record<string, unknown>;
}): Promise<boolean> {
  const target = resolveTarget(args.audience);
  if (!target) return false;

  const payload = {
    system_event: args.event,
    talent: { name: args.name ?? '', phone: args.phone, email: null },
    data: { talent_name: args.name ?? '', ...args.data },
    timestamp: new Date().toISOString(),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRM_TIMEOUT_MS);
  try {
    const res = await fetch(target.url, {
      method: 'POST',
      headers: target.headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[crm-event] ${args.audience}/${args.event} http_${res.status}`);
      return false;
    }
    try {
      const body = (await res.json()) as { data?: { skipped?: boolean } };
      if (body?.data?.skipped === true) return false;
    } catch {
      // Non-JSON / empty body → treat as a real send.
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[crm-event] ${args.audience}/${args.event} failed: ${msg.slice(0, 200)}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
