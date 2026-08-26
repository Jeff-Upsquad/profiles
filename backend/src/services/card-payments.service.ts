import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import {
  createPaymentLink as createRazorpayPaymentLink,
  cancelPaymentLink as cancelRazorpayPaymentLink,
  fetchPaymentLink as fetchRazorpayPaymentLink,
  isRazorpayConfigured,
} from './razorpay.service.js';
import {
  createPaymentLink as createCashfreePaymentLink,
  cancelPaymentLink as cancelCashfreePaymentLink,
  fetchPaymentLink as fetchCashfreePaymentLink,
  isCashfreeConfigured,
} from './cashfree.service.js';
import {
  getOrgPaymentGateway,
  isSquadBooksConfigured,
  raisePaidInvoice,
} from './squadbooks.service.js';
import { getCardRecipientsForReview, getMySubscriptionCard } from './business.service.js';

/**
 * Card payments — the business pays for the talent it selected on a card.
 *
 * Flow (see supabase/migrations/00122_card_payments.sql for the schema notes):
 *   1. Business clicks "Make Payment" under the selected talent.
 *   2. We ask SQUADbooks which gateway its Payment Gateway setting has enabled
 *      — Razorpay while that's the pick, Cashfree otherwise — then snapshot
 *      the agreed figure + the invoice line into a `card_payments` row FIRST,
 *      mint the payment link there, and hand back its URL.
 *   3. The gateway's paid webhook marks the row paid.
 *   4. We ask SquadBooks to raise the (already-paid) invoice and WhatsApp it.
 *
 * Steps 3 and 4 are tracked separately on purpose: the money landing and the
 * invoice being raised are different facts, and only the second one can fail in
 * a way that's safe to retry. {@link sweepPendingCardInvoices} picks up any paid
 * payment whose invoice never got raised (or never got delivered) and retries
 * it, so a successful charge can never end up with no invoice.
 */

const MAX_INVOICE_ATTEMPTS = 10;
/** Unpaid links expire after this long, freeing the selection for a fresh try. */
const LINK_TTL_MINUTES = 60;

/** The gateways a card payment can be collected on. */
export type CardGateway = 'razorpay' | 'cashfree';

export type CardPaymentStatus = 'created' | 'paid' | 'failed' | 'cancelled';

export interface CardPaymentView {
  id: string;
  status: CardPaymentStatus;
  amount: number;
  currency: string;
  period: 'per_month' | 'project';
  /** Which gateway minted this payment's hosted checkout page. */
  gateway: CardGateway;
  payment_url: string | null;
  paid_at: string | null;
  invoice_number: string | null;
  invoice_url: string | null;
  invoice_synced_at: string | null;
  invoice_sent_at: string | null;
}

interface PaymentContext {
  card: Awaited<ReturnType<typeof getMySubscriptionCard>>;
  recipient: { recipient_id: string; talent_name: string | null; tier: string | null };
  amount: number;
  currency: string;
  period: 'per_month' | 'project';
  lineItem: { name: string; description: string };
  talentUserId: string | null;
}

function toView(row: Record<string, unknown>): CardPaymentView {
  return {
    id: row.id as string,
    status: row.status as CardPaymentStatus,
    amount: Number(row.amount),
    currency: (row.currency as string) ?? 'INR',
    period: (row.period as 'per_month' | 'project') ?? 'per_month',
    gateway: row.gateway === 'cashfree' ? 'cashfree' : 'razorpay',
    payment_url: (row.payment_link_url as string | null) ?? null,
    paid_at: (row.paid_at as string | null) ?? null,
    invoice_number: (row.squadbooks_invoice_number as string | null) ?? null,
    invoice_url: (row.squadbooks_invoice_url as string | null) ?? null,
    invoice_synced_at: (row.invoice_synced_at as string | null) ?? null,
    invoice_sent_at: (row.invoice_sent_at as string | null) ?? null,
  };
}

/**
 * The invoice line for a card payment.
 *
 * For a subscription card we name it exactly like SquadBooks' synced catalog
 * item — "<Subscription> subscription · <Plan> plan · <Level>" — so the invoice
 * reconciles against the subscription catalog. The RATE is the agreed figure,
 * not the catalog rate, because a negotiated bid must invoice at what was
 * actually agreed. Assignment cards have no plan, so they fall back to the
 * project wording.
 */
function buildLineItem(
  card: PaymentContext['card'],
  talentName: string | null,
  period: 'per_month' | 'project',
): { name: string; description: string } {
  const levelLabel = (tier: string | null): string => {
    const t = (tier ?? '').trim().toLowerCase();
    if (t === 'junior') return 'Junior level';
    if (t === 'pro') return 'Pro level';
    if (t === 'top talents') return 'Top talent';
    return tier ? `${tier} level` : '';
  };

  const descriptionParts: string[] = [];
  if (talentName) descriptionParts.push(talentName);
  if (card.brand_name) descriptionParts.push(card.brand_name);
  descriptionParts.push(`Ref ${card.external_id}`);
  const description = descriptionParts.join(' · ');

  if (period === 'project' || card.card_type === 'assignment') {
    const category = card.categories?.[0]?.name;
    return {
      name: `Freelance assignment${category ? ` — ${category}` : ''}`,
      description,
    };
  }

  const parts: string[] = [];
  if (card.subscription_name) parts.push(`${card.subscription_name} subscription`);
  if (card.plan_name) parts.push(`${card.plan_name} plan`);
  const level = levelLabel(card.plan_tier);
  if (level) parts.push(level);
  const name = parts.length
    ? parts.join(' · ')
    : `Talent subscription${card.categories?.[0]?.name ? ` — ${card.categories[0].name}` : ''}`;

  return { name, description: `${description} · First month` };
}

/**
 * Resolve everything a payment needs from the card + selected recipient, using
 * the SAME price the review UI shows (accepted bid if any, else the card's list
 * price) so the invoice figure always matches what the client saw on screen.
 */
async function resolvePaymentContext(
  businessUserId: string,
  cardId: string,
  recipientId: string,
): Promise<PaymentContext> {
  const card = await getMySubscriptionCard(businessUserId, cardId);
  const recipients = await getCardRecipientsForReview(businessUserId, cardId);
  const recipient = recipients.find((r) => r.recipient_id === recipientId);

  if (!recipient) throw new AppError(404, 'Talent not found on this card');
  if (!recipient.selected_at) {
    throw new AppError(400, 'Payment is only available once you have selected this talent');
  }

  const offerAmount = recipient.offer_amount as
    | { amount?: number; currency?: string; period?: string }
    | null;
  const amount =
    offerAmount && typeof offerAmount.amount === 'number' && offerAmount.amount > 0
      ? offerAmount.amount
      : recipient.proposed_price ?? null;

  if (typeof amount !== 'number' || !(amount > 0)) {
    throw new AppError(
      400,
      'This card has no agreed price yet, so there is nothing to pay. Agree a figure with the talent first.',
    );
  }

  const isAssignment = card.card_type === 'assignment';
  const period: 'per_month' | 'project' =
    isAssignment || offerAmount?.period === 'project' ? 'project' : 'per_month';
  const currency = (offerAmount?.currency || recipient.currency || card.currency || 'INR').toUpperCase();

  return {
    card,
    recipient: {
      recipient_id: recipient.recipient_id,
      talent_name: recipient.talent_name,
      tier: recipient.tier,
    },
    amount: Math.round(amount * 100) / 100,
    currency,
    period,
    lineItem: buildLineItem(card, recipient.talent_name, period),
    talentUserId: recipient.talent_user_id ?? null,
  };
}

/**
 * Which gateway new payments will be minted on: SQUADbooks' Payment Gateway
 * setting decides — Razorpay while that's what it has enabled, Cashfree
 * otherwise. Null when the winning gateway has no usable credentials, i.e.
 * payments are switched off. Also surfaced on the review page so the
 * "Secured by …" label matches what a click will actually do.
 */
export async function getActiveCardGateway(): Promise<CardGateway | null> {
  const preferred = await getOrgPaymentGateway();
  if (preferred === 'cashfree') return isCashfreeConfigured() ? 'cashfree' : null;
  return isRazorpayConfigured() ? 'razorpay' : null;
}

/**
 * A payment left sitting in `created` past its TTL is reconciled against its
 * gateway before we report it — a webhook can be delayed or lost, and the
 * client must never be shown "Pay now" for something they already paid.
 * Returns the row to report, or null when it turned out to be dead.
 */
async function reconcileIfStale(
  row: Record<string, unknown>,
  force = false,
): Promise<Record<string, unknown> | null> {
  if (row.status !== 'created') return row;

  // `force` is the just-returned-from-checkout case: the client is back on the
  // card page seconds after paying and the webhook may still be in flight, so
  // we ask the gateway directly rather than showing them "Pay now" again.
  const ageMs = Date.now() - new Date(row.created_at as string).getTime();
  if (!force && ageMs <= LINK_TTL_MINUTES * 60_000) return row;

  const linkId = row.payment_link_id as string | null;
  if (!linkId) {
    // Minting died before the link was stored — retire it so a fresh attempt
    // isn't blocked by the one-live-payment index. Only once it's actually
    // stale: a forced check can race a link that's still being minted.
    if (ageMs <= LINK_TTL_MINUTES * 60_000) return row;
    await supabaseAdmin.from('card_payments').update({ status: 'failed' }).eq('id', row.id as string);
    return null;
  }

  const live =
    row.gateway === 'cashfree'
      ? await fetchCashfreePaymentLink(linkId)
      : await fetchRazorpayPaymentLink(linkId);
  if (live?.status === 'paid') {
    await markPaymentPaid(row.id as string, null, live.amountPaid);
    await syncCardPaymentInvoice(row.id as string).catch((e) => {
      console.error(`[card-payments] ${row.id}: invoice sync failed:`, (e as Error).message);
    });
    const { data: fresh } = await supabaseAdmin
      .from('card_payments')
      .select('*')
      .eq('id', row.id as string)
      .maybeSingle();
    return (fresh as Record<string, unknown> | null) ?? row;
  }
  if (live && ['cancelled', 'expired'].includes(live.status) && ageMs > LINK_TTL_MINUTES * 60_000) {
    await supabaseAdmin
      .from('card_payments')
      .update({ status: 'cancelled' })
      .eq('id', row.id as string);
    return null;
  }
  return row;
}

/** The payment (if any) for one selected talent, for the review page. */
export async function getCardPayment(
  businessUserId: string,
  cardId: string,
  recipientId: string,
  opts?: { force?: boolean },
): Promise<CardPaymentView | null> {
  const { data, error } = await supabaseAdmin
    .from('card_payments')
    .select('*')
    .eq('business_user_id', businessUserId)
    .eq('card_id', cardId)
    .eq('recipient_id', recipientId)
    .in('status', ['created', 'paid'])
    .maybeSingle();
  if (error) {
    console.error('[card-payments] load payment failed:', error.message);
    throw new AppError(500, 'Something went wrong while loading the payment. Please try again.');
  }
  if (!data) return null;

  const row = await reconcileIfStale(data as Record<string, unknown>, opts?.force);
  return row ? toView(row) : null;
}

/** Every payment on a card, keyed by recipient — one read for the review page. */
export async function getCardPayments(
  businessUserId: string,
  cardId: string,
  opts?: { force?: boolean },
): Promise<Record<string, CardPaymentView>> {
  const { data, error } = await supabaseAdmin
    .from('card_payments')
    .select('*')
    .eq('business_user_id', businessUserId)
    .eq('card_id', cardId)
    .in('status', ['created', 'paid']);
  if (error) {
    console.error('[card-payments] load payments failed:', error.message);
    throw new AppError(500, 'Something went wrong while loading payments. Please try again.');
  }

  const out: Record<string, CardPaymentView> = {};
  for (const raw of data ?? []) {
    const row = await reconcileIfStale(raw as Record<string, unknown>, opts?.force);
    if (row) out[row.recipient_id as string] = toView(row);
  }
  return out;
}

/**
 * Start (or resume) a payment for a selected talent on the gateway SQUADbooks
 * has enabled. Returns the hosted checkout URL the client is sent to. Resumes
 * an existing unpaid link rather than minting a second one, and refuses
 * outright once the payment has already been made.
 */
export async function startCardPayment(
  businessUserId: string,
  cardId: string,
  recipientId: string,
): Promise<{ payment: CardPaymentView; alreadyPaid: boolean }> {
  const gateway = await getActiveCardGateway();
  if (!gateway) {
    throw new AppError(503, 'Payments are not available right now. Please contact support.');
  }

  const existing = await getCardPayment(businessUserId, cardId, recipientId);
  if (existing?.status === 'paid') {
    return { payment: existing, alreadyPaid: true };
  }
  if (existing?.status === 'created' && existing.payment_url) {
    return { payment: existing, alreadyPaid: false };
  }
  if (existing?.status === 'created') {
    // A row with no link: minting died between the insert and the update. Retire
    // it, or the one-live-payment index blocks every retry from here on.
    await supabaseAdmin
      .from('card_payments')
      .update({ status: 'failed', invoice_last_error: 'Payment link was never created' })
      .eq('id', existing.id);
  }

  const ctx = await resolvePaymentContext(businessUserId, cardId, recipientId);

  const { data: business, error: bizErr } = await supabaseAdmin
    .from('business_users')
    .select('id, company_name, contact_person_name, contact_email, contact_phone')
    .eq('id', businessUserId)
    .maybeSingle();
  if (bizErr) {
    console.error('[card-payments] load business failed:', bizErr.message);
    throw new AppError(
      500,
      "Couldn't start the payment. Please try again in a few minutes — if it keeps failing, contact support.",
    );
  }
  if (!business) throw new AppError(404, 'Business account not found');

  // Persist BEFORE minting the link, so the gateway can never confirm a
  // payment we have no record of. The row carries the snapshot the invoice is
  // built from, plus which gateway owns its link.
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('card_payments')
    .insert({
      card_id: cardId,
      recipient_id: recipientId,
      business_user_id: businessUserId,
      talent_user_id: ctx.talentUserId,
      amount: ctx.amount,
      currency: ctx.currency,
      period: ctx.period,
      line_item: ctx.lineItem,
      gateway,
      status: 'created',
    })
    .select('*')
    .single();
  if (insErr) {
    // The partial unique index means a concurrent click already opened one.
    const concurrent = await getCardPayment(businessUserId, cardId, recipientId);
    if (concurrent) return { payment: concurrent, alreadyPaid: concurrent.status === 'paid' };
    console.error(`[card-payments] insert failed (card=${cardId}):`, insErr.message);
    throw new AppError(
      500,
      "Couldn't start the payment. Please try again in a few minutes — if it keeps failing, contact support.",
    );
  }

  const paymentId = (inserted as Record<string, unknown>).id as string;
  const appUrl = (env.BUSINESS_APP_URL || env.CORS_ORIGIN.split(',')[0] || '').replace(/\/$/, '');

  // Held outside the try so the catch can retire a link that WAS created but
  // whose id we then failed to store — otherwise it stays payable with nothing
  // on our side listening for it.
  let mintedLinkId: string | null = null;

  try {
    const mintInput = {
      amount: ctx.amount,
      currency: ctx.currency,
      description: `${ctx.lineItem.name} — ${ctx.lineItem.description}`.slice(0, 200),
      customer: {
        name: (business as any).company_name || (business as any).contact_person_name || 'Client',
        email: (business as any).contact_email ?? undefined,
        contact: (business as any).contact_phone ?? undefined,
      },
      notes: {
        // Echoed back on the webhook — how we find this row again.
        card_payment_id: paymentId,
        card_id: cardId,
        recipient_id: recipientId,
        source: 'squadhire',
      },
      callbackUrl: appUrl ? `${appUrl}/business/hire/${cardId}?payment=done` : undefined,
      expireBy: Math.floor(Date.now() / 1000) + LINK_TTL_MINUTES * 60,
    };
    // Both services speak the same shape; only the wire format differs
    // (Razorpay wants paise, Cashfree rupees).
    const link =
      gateway === 'cashfree'
        ? await createCashfreePaymentLink(mintInput)
        : await createRazorpayPaymentLink(mintInput);

    mintedLinkId = link.id;

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('card_payments')
      .update({
        payment_link_id: link.id,
        payment_link_url: link.shortUrl,
      })
      .eq('id', paymentId)
      .select('*')
      .single();
    if (updErr) throw new Error(updErr.message);

    return { payment: toView(updated as Record<string, unknown>), alreadyPaid: false };
  } catch (err) {
    // Retire the row so the client can try again cleanly, and best-effort cancel
    // any link the gateway did create before we lost the thread.
    if (mintedLinkId) {
      await (gateway === 'cashfree'
        ? cancelCashfreePaymentLink(mintedLinkId)
        : cancelRazorpayPaymentLink(mintedLinkId)
      ).catch(() => undefined);
    }
    await supabaseAdmin
      .from('card_payments')
      .update({ status: 'failed', invoice_last_error: (err as Error).message })
      .eq('id', paymentId);
    // The raw gateway/DB reason stays server-side (logs + the row above) —
    // the customer only ever sees the generic message.
    console.error(
      `[card-payments] link mint failed (payment=${paymentId}, gateway=${gateway}):`,
      (err as Error).message,
    );
    throw new AppError(
      502,
      "Couldn't start the payment. Please try again in a few minutes — if it keeps failing, contact support.",
    );
  }
}

/**
 * Mark a payment received. Idempotent — a repeated webhook (gateways retry at
 * least once) finds the row already paid and does nothing. Returns true when
 * this call is the one that flipped it, so the caller can raise the invoice.
 */
async function markPaymentPaid(
  paymentId: string,
  gatewayPaymentId: string | null,
  amountPaid: number,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('card_payments')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      gateway_payment_id: gatewayPaymentId,
    })
    .eq('id', paymentId)
    .eq('status', 'created')
    .select('id, amount')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;

  const expected = Number((data as Record<string, unknown>).amount);
  if (amountPaid > 0 && Math.abs(expected - amountPaid) > 0.01) {
    // Never silently invoice a different figure than was collected. The invoice
    // is raised from the row's snapshot, so flag the mismatch loudly instead.
    console.error(
      `[card-payments] ${paymentId}: collected ${amountPaid} but the agreed figure was ${expected}`,
    );
  }
  return true;
}

/**
 * Handle a verified "payment link paid" webhook from either gateway. Marks the
 * payment received and immediately attempts the SquadBooks invoice; if that
 * attempt fails the row is left in the sweeper's queue rather than failing the
 * webhook (which would only make the gateway retry the whole thing).
 */
export async function handlePaymentLinkPaid(input: {
  cardPaymentId?: string | null;
  linkId?: string | null;
  gatewayPaymentId?: string | null;
  amountPaid: number;
}): Promise<{ matched: boolean }> {
  let query = supabaseAdmin.from('card_payments').select('id, status').limit(1);
  query = input.cardPaymentId
    ? query.eq('id', input.cardPaymentId)
    : query.eq('payment_link_id', input.linkId!);

  const { data: row, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return { matched: false };

  const paymentId = (row as Record<string, unknown>).id as string;
  await markPaymentPaid(paymentId, input.gatewayPaymentId ?? null, input.amountPaid);

  // Raise the invoice on the first confirmation, and also on a redelivery that
  // finds it still missing (e.g. the first attempt died mid-call). Never let a
  // failure here fail the webhook — the sweeper owns the retry.
  await syncCardPaymentInvoice(paymentId).catch((e) => {
    console.error(`[card-payments] ${paymentId}: invoice sync failed:`, (e as Error).message);
  });

  return { matched: true };
}

/**
 * Settle a Cashfree generic PAYMENT_SUCCESS event. Orders created from a link
 * embed the link's URL slug ("CFPay_<slug>_<rand>"), and we store that URL on
 * the row — so match on the slug segment. No match means the payment isn't one
 * of ours (the event fires account-wide); the caller just acks.
 */
export async function handleCardPaymentByLinkSlug(input: {
  slug: string;
  gatewayPaymentId: string | null;
  amountPaid: number;
}): Promise<{ matched: boolean }> {
  const { data: row, error } = await supabaseAdmin
    .from('card_payments')
    .select('id, status')
    .like('payment_link_url', `%/${input.slug}`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return { matched: false };

  const paymentId = (row as Record<string, unknown>).id as string;
  await markPaymentPaid(paymentId, input.gatewayPaymentId, input.amountPaid);

  await syncCardPaymentInvoice(paymentId).catch((e) => {
    console.error(`[card-payments] ${paymentId}: invoice sync failed:`, (e as Error).message);
  });

  return { matched: true };
}

/**
 * Ask SquadBooks to raise the invoice for a paid card payment (and WhatsApp it).
 * Safe to call repeatedly: SquadBooks is idempotent on our row id, and a row
 * already fully synced and delivered returns early.
 */
export async function syncCardPaymentInvoice(paymentId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('card_payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;

  const row = data as Record<string, unknown>;
  if (row.status !== 'paid') return;
  if (row.invoice_synced_at && row.invoice_sent_at) return;
  if (Number(row.invoice_attempts ?? 0) >= MAX_INVOICE_ATTEMPTS) return;

  if (!isSquadBooksConfigured()) {
    await supabaseAdmin
      .from('card_payments')
      .update({
        invoice_attempts: Number(row.invoice_attempts ?? 0) + 1,
        invoice_last_error: 'SquadBooks integration is not configured',
      })
      .eq('id', paymentId);
    return;
  }

  const { data: business } = await supabaseAdmin
    .from('business_users')
    .select('company_name, contact_person_name, contact_email, contact_phone')
    .eq('id', row.business_user_id as string)
    .maybeSingle();

  const line = (row.line_item ?? {}) as { name?: string; description?: string };
  const biz = (business ?? {}) as Record<string, string | null>;
  const displayName = biz.company_name || biz.contact_person_name || 'Client';

  const result = await raisePaidInvoice({
    idempotencyKey: paymentId,
    customer: {
      displayName,
      companyName: biz.company_name,
      contactPersonName: biz.contact_person_name,
      email: biz.contact_email,
      phone: biz.contact_phone,
    },
    lineItem: {
      name: line.name || 'Talent subscription',
      description: line.description,
      quantity: 1,
      rate: Number(row.amount),
    },
    amount: Number(row.amount),
    currency: (row.currency as string) || 'INR',
    payment: {
      reference: (row.gateway_payment_id as string | null) ?? undefined,
      mode: row.gateway === 'cashfree' ? 'Cashfree' : 'Razorpay',
      paidAt: (row.paid_at as string | null) ?? undefined,
    },
  });

  if (!result.ok) {
    await supabaseAdmin
      .from('card_payments')
      .update({
        invoice_attempts: Number(row.invoice_attempts ?? 0) + 1,
        invoice_last_error: result.error ?? 'Unknown error',
      })
      .eq('id', paymentId);
    throw new Error(result.error ?? 'SquadBooks rejected the invoice');
  }

  await supabaseAdmin
    .from('card_payments')
    .update({
      squadbooks_customer_id: result.customerId ?? null,
      squadbooks_invoice_id: result.invoice?.id ?? null,
      squadbooks_invoice_number: result.invoice?.number ?? null,
      squadbooks_invoice_url: result.invoice?.url ?? null,
      invoice_synced_at: new Date().toISOString(),
      invoice_sent_at: result.whatsappSent ? new Date().toISOString() : null,
      invoice_attempts: Number(row.invoice_attempts ?? 0) + 1,
      invoice_last_error: result.whatsappSent ? null : (result.whatsappError ?? null),
    })
    .eq('id', paymentId);
}

/**
 * Retry every paid payment whose invoice hasn't been raised, or was raised but
 * never delivered. This is the guarantee that a completed charge always ends up
 * invoiced even if SquadBooks (or the CRM) was down at the moment of payment.
 */
export async function sweepPendingCardInvoices(): Promise<{ retried: number; failed: number }> {
  const { data, error } = await supabaseAdmin
    .from('card_payments')
    .select('id')
    .eq('status', 'paid')
    .or('invoice_synced_at.is.null,invoice_sent_at.is.null')
    .lt('invoice_attempts', MAX_INVOICE_ATTEMPTS)
    .order('paid_at', { ascending: true })
    .limit(25);
  if (error) throw new Error(error.message);

  let retried = 0;
  let failed = 0;
  for (const row of data ?? []) {
    const id = (row as Record<string, unknown>).id as string;
    try {
      await syncCardPaymentInvoice(id);
      retried += 1;
    } catch (e) {
      failed += 1;
      console.error(`[card-payments sweeper] ${id}:`, (e as Error).message);
    }
  }
  return { retried, failed };
}

/**
 * Background retry loop for the above. Runs every few minutes rather than every
 * few seconds: the happy path already raises the invoice inline off the webhook,
 * so this only ever picks up genuine failures.
 */
const SWEEPER_INTERVAL_MS = 5 * 60_000;

export function startCardPaymentsSweeper(): NodeJS.Timeout {
  const tick = async () => {
    if (!isSquadBooksConfigured()) return;
    try {
      const { retried, failed } = await sweepPendingCardInvoices();
      if (retried || failed) {
        console.log(`[card-payments sweeper] retried ${retried}, failed ${failed}`);
      }
    } catch (e) {
      console.error('[card-payments sweeper] tick failed:', (e as Error).message);
    }
  };

  const handle = setInterval(tick, SWEEPER_INTERVAL_MS);
  setTimeout(tick, 30_000);
  return handle;
}
