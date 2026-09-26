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
// A request-change event can send the button template and checklist separately.
const REQUEST_CHANGES_TIMEOUT_MS = 12_000;

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
  // Explicit {{1}},{{2}},... body values. Without this the CRM falls back to
  // `data`'s value order, which is fine for single-variable templates but too
  // fragile for multi-variable ones.
  bodyParams?: string[];
  // Value appended to a dynamic URL button's base, e.g. a card id for a
  // "View card" deep link. Ignored by templates without such a button.
  buttonUrlParam?: string;
}): Promise<boolean> {
  const target = resolveTarget(args.audience);
  if (!target) return false;

  const payload = {
    system_event: args.event,
    talent: { name: args.name ?? '', phone: args.phone, email: null },
    data: { talent_name: args.name ?? '', ...args.data },
    ...(args.bodyParams ? { body_params: args.bodyParams } : {}),
    ...(args.buttonUrlParam ? { button_url_param: args.buttonUrlParam } : {}),
    timestamp: new Date().toISOString(),
  };

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    args.event === 'talent_profile_changes_requested' ? REQUEST_CHANGES_TIMEOUT_MS : CRM_TIMEOUT_MS,
  );
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
      const body = (await res.json()) as { data?: { skipped?: boolean; reason?: string } };
      if (body?.data?.skipped === true) {
        // Accepted but not sent (e.g. template_not_approved) — surface it, or a
        // WhatsApp outage looks identical to a successful send in the logs.
        console.warn(`[crm-event] ${args.audience}/${args.event} skipped: ${body.data.reason ?? 'unknown'}`);
        return false;
      }
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
