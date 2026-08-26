import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';
import type { CreatePaymentLinkInput, PaymentLink } from './razorpay.service.js';

/**
 * Cashfree Payment Links, for card payments a business makes inside SquadHire.
 *
 * The twin of {@link razorpay.service.ts} (same input/output shapes) so the
 * card-payments flow can dispatch between gateways without branching its
 * logic. Which gateway is live is decided per payment by the org's Payment
 * Gateway setting in SQUADbooks — this service only ever runs when that
 * setting says Cashfree.
 *
 * Talks to the REST API directly with `x-client-id` / `x-client-secret`
 * headers rather than pulling in the SDK — we need exactly two calls.
 * Amounts are RUPEES with up to two decimals (unlike Razorpay's paise).
 *
 * Webhook verification: Cashfree signs webhooks with the SAME secret used for
 * API auth (no separate webhook secret) — Base64(HMAC-SHA256 over
 * `${x-webhook-timestamp}${rawBody}`), mirroring SquadBooks' implementation.
 */

const API_VERSION = env.CASHFREE_API_VERSION || '2023-08-01';

export function isCashfreeConfigured(): boolean {
  return !!(env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY);
}

function apiBase(): string {
  return (env.CASHFREE_ENV || 'live').toLowerCase() === 'sandbox'
    ? 'https://sandbox.cashfree.com'
    : 'https://api.cashfree.com';
}

function authHeaders(): Record<string, string> {
  return {
    'x-client-id': env.CASHFREE_APP_ID!,
    'x-client-secret': env.CASHFREE_SECRET_KEY!,
    'x-api-version': API_VERSION,
  };
}

/** Cashfree errors look like `{ code, message }` — pull the human reason out. */
function describeError(body: unknown, status: number): string {
  const o = body as { message?: string; description?: string; code?: string } | null;
  return o?.message || o?.description || o?.code || `Cashfree responded ${status}`;
}

async function cfFetch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  if (!isCashfreeConfigured()) {
    throw new Error('Cashfree is not configured (set CASHFREE_APP_ID and CASHFREE_SECRET_KEY).');
  }
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) throw new Error(describeError(body, res.status));
  return body ?? {};
}

/**
 * Map a raw gateway link status onto our lowercase lifecycle
 * (`created | paid | cancelled | expired`) so callers never branch on the
 * gateway themselves. Mirrors SquadBooks' normalization.
 */
export function normalizeLinkStatus(raw?: string): string {
  switch ((raw ?? '').toLowerCase()) {
    case 'paid':
      return 'paid';
    case 'cancelled':
    case 'deactivated':
      return 'cancelled';
    case 'expired':
      return 'expired';
    default:
      // Razorpay "created", Cashfree "ACTIVE"
      return 'created';
  }
}

/**
 * Create a hosted, shareable payment link for one card payment. Partial
 * payment is off and Cashfree's own SMS/email notifications are disabled —
 * the client is redirected straight to the link, and the receipt reaches them
 * on WhatsApp from SquadBooks once the invoice exists (same contract as the
 * Razorpay path).
 */
export async function createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLink> {
  const link = await cfFetch('/pg/links', {
    method: 'POST',
    body: JSON.stringify({
      // Cashfree wants rupees, not paise.
      link_amount: Math.round(input.amount * 100) / 100,
      link_currency: input.currency || 'INR',
      link_purpose: input.description.slice(0, 255),
      customer_details: {
        customer_name: input.customer.name,
        ...(input.customer.contact ? { customer_phone: input.customer.contact } : {}),
        ...(input.customer.email ? { customer_email: input.customer.email } : {}),
      },
      link_partial_payments: false,
      link_notify: { send_sms: false, send_email: false },
      link_auto_reminders: false,
      // Echoed back verbatim on the webhook — how we find our own payment row.
      link_notes: input.notes,
      ...(input.callbackUrl ? { link_meta: { return_url: input.callbackUrl } } : {}),
      ...(input.expireBy ? { link_expiry_time: input.expireBy } : {}),
    }),
  });

  const id = String(link.link_id ?? link.cf_link_id ?? '');
  const shortUrl = String(link.link_url ?? '');
  if (!id || !shortUrl) throw new Error('Cashfree did not return a payment link.');
  return { id, shortUrl, status: normalizeLinkStatus(link.link_status as string | undefined) };
}

/**
 * Cancel a link so it can no longer be paid. Cashfree only allows cancelling a
 * still-ACTIVE link, so callers should treat a throw as non-fatal.
 */
export async function cancelPaymentLink(linkId: string): Promise<void> {
  await cfFetch(`/pg/links/${encodeURIComponent(linkId)}/cancel`, { method: 'POST' });
}

/** Current state of a link, used to reconcile when a webhook never arrived. */
export async function fetchPaymentLink(
  linkId: string,
): Promise<{ status: string; amountPaid: number } | null> {
  if (!isCashfreeConfigured()) return null;
  let body: Record<string, unknown>;
  try {
    body = await cfFetch(`/pg/links/${encodeURIComponent(linkId)}`);
  } catch {
    return null;
  }
  const status = normalizeLinkStatus(body.link_status as string | undefined);
  // Links are non-partial: a paid link means the full amount landed. Prefer the
  // running paid total where Cashfree reports it, else the link amount.
  const amountPaid =
    status === 'paid'
      ? Number(body.link_amount ?? body.link_amount_paid ?? 0)
      : Number(body.link_amount_paid ?? 0);
  return { status, amountPaid };
}

/**
 * Verify a Cashfree webhook signature against the RAW request body:
 * Base64(HMAC-SHA256(`${timestamp}${body}`, clientSecret)) compared to the
 * `x-webhook-signature` header. Fails closed when anything is missing — an
 * unverified webhook must never be allowed to mark a payment as received.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  timestamp: string | undefined,
  signature: string | undefined,
): boolean {
  const secret = env.CASHFREE_SECRET_KEY;
  if (!signature || !timestamp || !secret) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  const expected = createHmac('sha256', secret)
    .update(Buffer.concat([Buffer.from(timestamp, 'utf8'), body]))
    .digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
