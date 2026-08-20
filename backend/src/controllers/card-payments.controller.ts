import { Request, Response, NextFunction } from 'express';
import * as cardPayments from '../services/card-payments.service.js';
import { verifyWebhookSignature } from '../services/razorpay.service.js';

/**
 * Card payments — the business-facing "Make Payment" endpoints plus the Razorpay
 * webhook that confirms the money landed.
 */

/**
 * GET /business/my-subscription-cards/:cardId/payments — keyed by recipient.
 * `?refresh=1` forces a live check against Razorpay, which the card page sends
 * when the client has just come back from the checkout and the webhook may not
 * have landed yet.
 */
export async function listCardPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const payments = await cardPayments.getCardPayments(
      req.user!.id,
      req.params.cardId as string,
      { force: req.query.refresh === '1' },
    );
    res.json({ payments });
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
 * POST …/recipients/:recipientId/payment — start (or resume) the payment and
 * hand back the hosted Razorpay URL for the client to be sent to.
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

  if (!verifyWebhookSignature(raw, signature)) {
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
      razorpayLinkId: linkId,
      razorpayPaymentId: (payment.id as string | undefined) ?? null,
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
