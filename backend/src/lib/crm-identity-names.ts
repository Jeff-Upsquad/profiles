/**
 * Push person / brand name changes to Squad CRM so matched leads, contacts,
 * and Hub rows stay aligned. Best-effort — never throws into the caller.
 */
import { env } from '../config/env.js';

const CRM_TIMEOUT_MS = 8_000;

export async function pushCrmIdentityNames(input: {
  phone?: string | null;
  email?: string | null;
  person_name?: string | null;
  brand_name?: string | null;
}): Promise<void> {
  const person = input.person_name?.trim() || null;
  const brand = input.brand_name?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  if (!person && !brand) return;
  if (!email && !phone) return;

  const apiUrl = (env.SQUADCRM_API_URL || '').replace(/\/$/, '');
  const secret = env.SQUADCRM_PROVISION_SECRET || '';
  if (!apiUrl || !secret) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRM_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiUrl}/integrations/squadhire/identity-names`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SquadCRM-Signature': secret,
      },
      body: JSON.stringify({
        phone: phone || undefined,
        email: email || undefined,
        person_name: person || undefined,
        brand_name: brand || undefined,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(
        `[crm-identity-names] CRM responded ${res.status}: ${text.slice(0, 300)}`,
      );
    }
  } catch (err) {
    console.error('[crm-identity-names] request failed', err);
  } finally {
    clearTimeout(timer);
  }
}
