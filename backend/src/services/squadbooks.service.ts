import { env } from '../config/env.js';

/**
 * Server-to-server client for SquadBooks (books.squadhub.in).
 *
 * SquadHire collects a card payment on its own Razorpay account, then calls
 * SquadBooks to raise the matching invoice: find-or-create the customer, write a
 * PAID invoice, record the Payment Received, and WhatsApp it to the client with
 * receipt wording (no pay link — the money is already in).
 *
 * Uses the shared `x-admin-key` channel SquadBooks already exposes to sibling
 * apps. The call is idempotent on `idempotencyKey` (our card_payments row id),
 * so the sweeper can retry it freely: a retry returns the SAME invoice rather
 * than raising a second one.
 */

export function isSquadBooksConfigured(): boolean {
  return !!(env.SQUADBOOKS_API_URL && env.SQUADBOOKS_ADMIN_API_KEY && env.SQUADBOOKS_ORG_ID);
}

/** The payment gateway an org has enabled in SQUADbooks (Settings → Payment Gateway). */
export type SquadBooksGateway = 'razorpay' | 'cashfree';

/**
 * Which gateway should collect the next card payment.
 *
 * SQUADbooks is the source of truth: its Settings page picks exactly one active
 * gateway per org. We ask it server-to-server over the same `x-admin-key`
 * channel as the invoice call, and cache briefly so a burst of "Pay" clicks
 * doesn't turn into a burst of lookups.
 *
 * ALWAYS resolves: if SQUADbooks isn't configured, or the call fails, or the
 * answer is unknown, we fall back to Razorpay — the gateway SquadHire used
 * before Cashfree existed, so a SQUADbooks blip degrades to status quo rather
 * than breaking checkout.
 */
let cachedGateway: { value: SquadBooksGateway; readAt: number } | null = null;
const GATEWAY_CACHE_MS = 60_000;

export async function getOrgPaymentGateway(): Promise<SquadBooksGateway> {
  if (!isSquadBooksConfigured()) return 'razorpay';
  if (cachedGateway && Date.now() - cachedGateway.readAt < GATEWAY_CACHE_MS) {
    return cachedGateway.value;
  }

  let value: SquadBooksGateway = 'razorpay';
  try {
    const res = await fetch(
      `${env.SQUADBOOKS_API_URL!.replace(/\/$/, '')}/api/integrations/squadhire/payment-gateway?org_id=${env.SQUADBOOKS_ORG_ID}`,
      { headers: { 'x-admin-key': env.SQUADBOOKS_ADMIN_API_KEY! }, signal: AbortSignal.timeout(5_000) },
    );
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; gateway?: string }
      | null;
    if (res.ok && body?.gateway === 'cashfree') value = 'cashfree';
  } catch {
    // Unreachable SQUADbooks keeps the last-known default: Razorpay.
  }

  cachedGateway = { value, readAt: Date.now() };
  return value;
}

export interface RaisePaidInvoiceInput {
  idempotencyKey: string;
  customer: {
    displayName: string;
    companyName?: string | null;
    contactPersonName?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  lineItem: { name: string; description?: string | null; quantity?: number; rate?: number };
  amount: number;
  currency: string;
  payment: { reference?: string | null; mode?: string; paidAt?: string | null };
  notes?: string | null;
}

export interface RaisePaidInvoiceResult {
  ok: boolean;
  status: number;
  error?: string;
  alreadyExisted?: boolean;
  customerId?: string | null;
  invoice?: { id: string; number: string; url: string | null };
  /** Whether SquadBooks got the WhatsApp accepted by the CRM. */
  whatsappSent?: boolean;
  whatsappError?: string;
}

export async function raisePaidInvoice(
  input: RaisePaidInvoiceInput,
): Promise<RaisePaidInvoiceResult> {
  if (!isSquadBooksConfigured()) {
    return {
      ok: false,
      status: 503,
      error:
        'SquadBooks integration not configured (set SQUADBOOKS_API_URL, SQUADBOOKS_ADMIN_API_KEY and SQUADBOOKS_ORG_ID).',
    };
  }

  let res: Response;
  try {
    res = await fetch(
      `${env.SQUADBOOKS_API_URL!.replace(/\/$/, '')}/api/integrations/squadhire/paid-invoice`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': env.SQUADBOOKS_ADMIN_API_KEY!,
        },
        body: JSON.stringify({
          org_id: env.SQUADBOOKS_ORG_ID,
          org_name: env.SQUADBOOKS_ORG_NAME || undefined,
          idempotency_key: input.idempotencyKey,
          customer: {
            display_name: input.customer.displayName,
            company_name: input.customer.companyName || undefined,
            contact_person_name: input.customer.contactPersonName || undefined,
            email: input.customer.email || undefined,
            phone: input.customer.phone || undefined,
          },
          line_item: {
            name: input.lineItem.name,
            description: input.lineItem.description || undefined,
            quantity: input.lineItem.quantity ?? 1,
            rate: input.lineItem.rate ?? input.amount,
          },
          amount: input.amount,
          currency: input.currency,
          payment: {
            reference: input.payment.reference || undefined,
            mode: input.payment.mode || 'Razorpay',
            paid_at: input.payment.paidAt || undefined,
          },
          notes: input.notes || undefined,
          send_whatsapp: true,
        }),
      },
    );
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: `Couldn't reach SquadBooks: ${(err as Error).message}`,
    };
  }

  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    alreadyExisted?: boolean;
    customerId?: string | null;
    invoice?: { id: string; number: string; url: string | null };
    whatsapp?: { sent?: boolean; error?: string };
  } | null;

  if (!res.ok || !body?.ok) {
    return { ok: false, status: res.status, error: body?.error || 'SquadBooks rejected the call.' };
  }

  return {
    ok: true,
    status: 200,
    alreadyExisted: body.alreadyExisted,
    customerId: body.customerId ?? null,
    invoice: body.invoice,
    whatsappSent: body.whatsapp?.sent ?? false,
    whatsappError: body.whatsapp?.error,
  };
}
