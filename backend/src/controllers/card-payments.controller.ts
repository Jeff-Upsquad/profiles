import { Request, Response, NextFunction } from 'express';
import * as cardPayments from '../services/card-payments.service.js';
import { verifyWebhookSignature as verifyRazorpaySignature } from '../services/razorpay.service.js';
import { verifyWebhookSignature as verifyCashfreeSignature } from '../services/cashfree.service.js';

/**
 * Card payments — the business-facing "Make Payment" endpoints plus the gateway
 * webhooks that confirm the money landed. Which gateway collects a payment
 * follows SQUADbooks' Payment Gateway setting (Razorpay while enabled, Cashfree
 * otherwise), so both confirmation endpoints are hosted here.
 */

/**
 * GET /business/my-subscription-cards/:cardId/payments — keyed by recipient.
 * `?refresh=1` forces a live check against the minting gateway, which the card
 * page sends when the client has just come back from the checkout and the
 * webhook may not have landed yet. Also returns the gateway new payments will
 * use, so the UI's "Secured by …" label matches reality before any click.
 */
export async function listCardPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const [payments, gateway] = await Promise.all([
      cardPayments.getCardPayments(req.user!.id, req.params.cardId as string, {
        force: req.query.refresh === '1',
      }),
      cardPayments.getActiveCardGateway().catch(() => null),
    ]);
    res.json({ payments, gateway });
  } catch (err) {
    next(err);
  }
}

/** GET …/recipients/:recipientId/payment — one selected talent's payment. */
export async function getCardPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await cardPayments.getCardPayment(
      req.user!.id,
      req.params.cardId as string,
      req.params.recipientId as string,
      { force: req.query.refresh === '1' },
    );
    res.json({ payment });
  } catch (err) {
    next(err);
  }
}

/**
 * POST …/recipients/:recipientId/payment — start (or resume) the payment on the
 * gateway SQUADbooks has enabled and hand back the hosted checkout URL for the
 * client to be sent to.
 */
export async function startCardPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await cardPayments.startCardPayment(
      req.user!.id,
      req.params.cardId as string,
      req.params.recipientId as string,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /webhooks/razorpay — Razorpay's payment confirmation.
 *
 * Mounted with a RAW body parser (the HMAC is computed over the exact bytes
 * Razorpay sent, so a re-serialized JSON body would never verify). Every
 * outcome acks with 200 unless the signature itself is bad: Razorpay retries on
 * any non-2xx, and re-delivering an event we've already handled — or one that
 * isn't ours — achieves nothing.
 */
export async function razorpayWebhook(req: Request, res: Response) {
  const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body ?? ''));
  const signature = req.header('x-razorpay-signature') ?? undefined;

  if (!verifyRazorpaySignature(raw, signature)) {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  let event: {
    event?: string;
    payload?: {
      payment_link?: { entity?: Record<string, unknown> };
      payment?: { entity?: Record<string, unknown> };
    };
  };
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    res.status(400).json({ error: 'Bad JSON' });
    return;
  }

  // Links are accept_partial:false, so only the full-payment event matters.
  if (event.event !== 'payment_link.paid') {
    res.json({ received: true });
    return;
  }

  const link = event.payload?.payment_link?.entity ?? {};
  const payment = event.payload?.payment?.entity ?? {};
  const notes = (link.notes as Record<string, string> | undefined) ?? {};

  // Only handle links this app minted — SquadBooks raises its own Razorpay links
  // on the same merchant account, and its webhook handles those.
  if (notes.source && notes.source !== 'squadhire') {
    res.json({ received: true });
    return;
  }

  const cardPaymentId = notes.card_payment_id ?? null;
  const linkId = (link.id as string | undefined) ?? null;
  if (!cardPaymentId && !linkId) {
    res.json({ received: true });
    return;
  }

  const amountPaid =
    Number(payment.amount ?? link.amount_paid ?? link.amount ?? 0) / 100;

  try {
    const result = await cardPayments.handlePaymentLinkPaid({
      cardPaymentId,
      linkId,
      gatewayPaymentId: (payment.id as string | undefined) ?? null,
      amountPaid,
    });
    res.json({ received: true, matched: result.matched });
  } catch (err) {
    // The payment itself is real; log loudly and ack so Razorpay stops retrying.
    // The sweeper picks up anything left half-done.
    console.error('[razorpay webhook] handling failed:', (err as Error).message);
    res.json({ received: true, deferred: true });
  }
}

/**
 * POST /webhooks/cashfree — Cashfree's payment confirmation, for payments
 * minted while SQUADbooks has Cashfree enabled. Same raw-body mounting as the
 * Razorpay webhook; signature verification is Cashfree-specific (HMAC-SHA256
 * over timestamp+rawBody keyed with the client secret).
 *
 * Handles the two event shapes the dashboard can send:
 *
 * 1. "PAYMENT_LINK_EVENT" — the dedicated payment-link event; a PAID link
 *    settles the row (links are created non-partial). Routing comes from the
 *    echoed link_notes.
 *
 * 2. "PAYMENT_SUCCESS" — the generic event ("success payment" checkbox). Orders
 *    created from a link carry ids like "CFPay_<slug>_<rand>", where <slug> is
 *    the last segment of our stored payment_link_url — we match on that. Fires
 *    for EVERY successful payment on the account, so anything that isn't ours
 *    is simply acked.
 */
export async function cashfreeWebhook(req: Request, res: Response) {
  const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body ?? ''));
  const timestamp = req.header('x-webhook-timestamp') ?? undefined;
  const signature = req.header('x-webhook-signature') ?? undefined;

  if (!verifyCashfreeSignature(raw, timestamp, signature)) {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  let event: {
    type?: string;
    data?: {
      link?: Record<string, unknown>;
      order?: Record<string, unknown>;
      payment?: Record<string, unknown>;
    };
  };
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    res.status(400).json({ error: 'Bad JSON' });
    return;
  }

  if (event.type === 'PAYMENT_LINK_EVENT') {
    const link = event.data?.link ?? {};
    // Links are non-partial, so only a full PAID settles.
    if ((link.link_status as string | undefined) !== 'PAID') {
      res.json({ received: true });
      return;
    }
    const notes = (link.link_notes as Record<string, string> | undefined) ?? {};

    // Only handle links this app minted — SQUADbooks raises its own Cashfree
    // links on the same account, and its webhook handles those.
    if (notes.source && notes.source !== 'squadhire') {
      res.json({ received: true });
      return;
    }

    const cardPaymentId = notes.card_payment_id ?? null;
    const linkId = (link.link_id as string | undefined) ?? null;
    if (!cardPaymentId && !linkId) {
      res.json({ received: true });
      return;
    }

    // Prefer the order amount (the actual charge); fall back to the running
    // link total. Cashfree amounts are rupees.
    const order = event.data?.order ?? {};
    const amountPaid = Number(order.order_amount ?? link.link_amount_paid ?? link.link_amount ?? 0);

    try {
      const result = await cardPayments.handlePaymentLinkPaid({
        cardPaymentId,
        linkId,
        gatewayPaymentId: (order.order_id as string | undefined) ?? null,
        amountPaid,
      });
      res.json({ received: true, matched: result.matched });
    } catch (err) {
      console.error('[cashfree webhook] handling failed:', (err as Error).message);
      res.json({ received: true, deferred: true });
    }
    return;
  }

  if (event.type === 'PAYMENT_SUCCESS') {
    const order = event.data?.order ?? {};
    const payment = event.data?.payment ?? {};
    const orderId = (order.order_id as string | undefined) ?? '';
    const status = (payment.payment_status as string | undefined) ?? 'SUCCESS';
    if (!orderId.startsWith('CFPay_') || status !== 'SUCCESS') {
      res.json({ received: true });
      return;
    }
    const slug = orderId.split('_')[1] ?? '';
    if (!slug) {
      res.json({ received: true });
      return;
    }

    try {
      const result = await cardPayments.handleCardPaymentByLinkSlug({
        slug,
        gatewayPaymentId:
          (payment.cf_payment_id != null ? String(payment.cf_payment_id) : orderId) || orderId,
        amountPaid: Number(order.order_amount ?? payment.payment_amount ?? 0),
      });
      res.json({ received: true, matched: result.matched });
    } catch (err) {
      console.error('[cashfree webhook] handling failed:', (err as Error).message);
      res.json({ received: true, deferred: true });
    }
    return;
  }

  res.json({ received: true });
}
