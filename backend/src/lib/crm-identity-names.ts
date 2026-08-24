/**
 * Push person / brand name changes to Squad CRM and person-name changes to
 * SquadHire CRM so matched leads stay aligned. Best-effort — never throws.
 */
import { env } from '../config/env.js';

const CRM_TIMEOUT_MS = 8_000;

function shcrmApiOrigin(): string | null {
  const explicit = (env.SQUADHIRE_CRM_API_URL || '').replace(/\/$/, '');
  if (explicit) return explicit;
  const events = env.SQUADHIRE_CRM_SYSTEM_EVENTS_URL;
  if (!events) return null;
  try {
    return new URL(events).origin;
  } catch {
    return null;
  }
}

async function postIdentityNames(args: {
  url: string;
  secret: string;
  secretHeader: string;
  body: Record<string, string | undefined>;
  label: string;
}): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRM_TIMEOUT_MS);
  try {
    const res = await fetch(args.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [args.secretHeader]: args.secret,
      },
      body: JSON.stringify(args.body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[${args.label}] CRM responded ${res.status}: ${text.slice(0, 300)}`);
    }
  } catch (err) {
    console.error(`[${args.label}] request failed`, err);
  } finally {
    clearTimeout(timer);
  }
}

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

  await postIdentityNames({
    url: `${apiUrl}/integrations/squadhire/identity-names`,
    secret,
    secretHeader: 'X-SquadCRM-Signature',
    body: {
      phone: phone || undefined,
      email: email || undefined,
      person_name: person || undefined,
      brand_name: brand || undefined,
    },
    label: 'crm-identity-names',
  });
}

/** Talent signup / account settings → SquadHire CRM person name on matched leads. */
export async function pushShcrmIdentityNames(input: {
  phone?: string | null;
  email?: string | null;
  person_name?: string | null;
}): Promise<void> {
  const person = input.person_name?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  if (!person) return;
  if (!email && !phone) return;

  const apiUrl = shcrmApiOrigin();
  const secret = process.env.SQUADHIRE_CRM_INBOUND_SECRET || '';
  if (!apiUrl || !secret) return;

  await postIdentityNames({
    url: `${apiUrl}/integrations/squadhire/identity-names`,
    secret,
    secretHeader: 'X-SquadHire-Admin-Signature',
    body: {
      phone: phone || undefined,
      email: email || undefined,
      person_name: person,
    },
    label: 'shcrm-identity-names',
  });
}
