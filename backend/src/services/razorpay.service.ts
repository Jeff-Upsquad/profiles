import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';

/**
 * Razorpay Payment Links, for card payments a business makes inside SquadHire.
 *
 * Talks to the REST API directly (Basic auth with the key pair) rather than
 * pulling in the SDK — we need exactly two calls, and keeping the surface small
 * means nothing new to install on the VPS. The webhook HMAC check mirrors the
 * one in SquadBooks and Squad Payroll: SHA-256 over the RAW body, timing-safe
 * compare, failing closed whenever the secret or signature is missing.
 *
 * NOTE this is a different integration from SquadBooks' own Razorpay links even
 * though the merchant account is the same: SquadHire collects the money here and
 * only afterwards asks SquadBooks to raise the (already-paid) invoice.
 */

const API_BASE = 'https://api.razorpay.com/v1';

export function isRazorpayConfigured(): boolean {
  return !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

function authHeader(): string {
  const token = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  return `Basic ${token}`;
}

/**
 * Razorpay rejects errors as `{ error: { description, reason } }` rather than a
 * plain message, so pull the human reason out for logs and UI.
 */
function describeError(body: unknown, status: number): string {
  const o = body as { error?: { description?: string; reason?: string } } | null;
  return o?.error?.description || o?.error?.reason || `Razorpay responded ${status}`;
}

export interface CreatePaymentLinkInput {
  amount: number;
  currency: string;
  description: string;
  customer: { name: string; email?: string | null; contact?: string | null };
  /** Echoed back verbatim on the webhook — how we find our own payment row. */
  notes: Record<string, string>;
  /** Where the client lands after paying. */
  callbackUrl?: string;
  /** Link auto-expires if unpaid (unix seconds). */
  expireBy?: number;
}

export interface PaymentLink {
  id: string;
  shortUrl: string;
  status: string;
}

/**
 * Create a hosted, shareable payment link for one card payment. Partial payment
 * is off — the client either pays the agreed figure or nothing, so the invoice
 * we raise afterwards is always for the full amount. Razorpay's own SMS/email
 * notifications are disabled: the client is redirected straight to the link, and
 * the receipt reaches them on WhatsApp from SquadBooks once the invoice exists.
 */
export async function createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLink> {
  if (!isRazorpayConfigured()) {
    throw new Error('Razorpay is not configured (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET).');
  }

  const res = await fetch(`${API_BASE}/payment_links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({
      amount: Math.round(input.amount * 100),
      currency: input.currency || 'INR',
      accept_partial: false,
      description: input.description.slice(0, 2048),
      customer: {
        name: input.customer.name,
        email: input.customer.email || undefined,
        contact: input.customer.contact || undefined,
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: input.notes,
      ...(input.callbackUrl ? { callback_url: input.callbackUrl, callback_method: 'get' } : {}),
      ...(input.expireBy ? { expire_by: input.expireBy } : {}),
    }),
  });

  const body = (await res.json().catch(() => null)) as
    | { id?: string; short_url?: string; status?: string }
    | null;
  if (!res.ok || !body?.id || !body.short_url) {
    throw new Error(describeError(body, res.status));
  }
  return { id: body.id, shortUrl: body.short_url, status: body.status ?? 'created' };
}

/**
 * Cancel a link so it can no longer be paid. Razorpay only allows cancelling a
 * link still in `created` state, so callers should treat a throw as non-fatal.
 */
export async function cancelPaymentLink(linkId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/payment_links/${linkId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(describeError(body, res.status));
  }
}

/** Current state of a link, used to reconcile when a webhook never arrived. */
export async function fetchPaymentLink(
  linkId: string,
): Promise<{ status: string; amountPaid: number } | null> {
  if (!isRazorpayConfigured()) return null;
  const res = await fetch(`${API_BASE}/payment_links/${linkId}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as
    | { status?: string; amount_paid?: number }
    | null;
  if (!body?.status) return null;
  return { status: body.status, amountPaid: Number(body.amount_paid ?? 0) / 100 };
}

/**
 * Verify a Razorpay webhook signature against the RAW request body. Fails closed
 * when either the configured secret or the header is missing — an unverified
 * webhook must never be allowed to mark a payment as received.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string | undefined,
): boolean {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!signature || !secret) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
