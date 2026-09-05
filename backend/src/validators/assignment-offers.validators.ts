import { z } from 'zod';

/**
 * A negotiated figure on an assignment offer. `amount` is required; currency +
 * period are optional hints. `.passthrough()` keeps any extra keys SquadHub /
 * the UI attach (the service stores it verbatim in current_amount JSONB).
 */
const OFFER_AMOUNT_STEP = 500;

export const offerAmountSchema = z
  .object({
    amount: z
      .number()
      .positive()
      .refine((n) => Math.round(n) === n && n % OFFER_AMOUNT_STEP === 0, {
        message: `Offer amount must be a positive multiple of ₹${OFFER_AMOUNT_STEP}`,
      }),
    currency: z.string().trim().max(10).optional(),
    period: z.enum(['project', 'per_month', 'per_week', 'per_day', 'per_hour', 'per_design', 'per_video']).optional(),
    pricing_basis: z.enum(['project', 'per_unit']).optional(),
    unit: z.enum(['design', 'video']).optional(),
    quantity: z.number().int().min(1).max(999).optional(),
  })
  .passthrough();

// Talent submit (unpriced) / counter (priced or ongoing).
export const submitOfferSchema = z.object({
  amount: offerAmountSchema,
  terms: z.record(z.unknown()).optional(),
  note: z.string().trim().max(2000).optional(),
});

// Talent accept / decline the business counter, or withdraw their own submission.
export const talentOfferRespondSchema = z.object({
  action: z.enum(['accept', 'decline', 'withdraw']),
  note: z.string().trim().max(2000).optional(),
});

// Business/admin counter.
export const businessCounterSchema = z.object({
  amount: offerAmountSchema,
  terms: z.record(z.unknown()).optional(),
  note: z.string().trim().max(2000).optional(),
});

// Business/admin accept / decline (no figure).
export const businessOfferActionSchema = z.object({
  note: z.string().trim().max(2000).optional(),
});

export const cardIdOfferIdParamSchema = z.object({
  cardId: z.string().uuid(),
  offerId: z.string().uuid(),
});

export const cardIdParamSchema = z.object({
  cardId: z.string().uuid(),
});

// ─── SquadHub webhooks ──────────────────────────────────────────────────────

// Read-only live snapshot (SquadHub admin reads offers straight from here).
export const cardOffersSnapshotWebhookSchema = z.object({
  external_id: z.string().min(1).max(200),
  source: z.string().optional(),
});

// Business send a new offer to a talent (or revise / counter via service).
export const businessSendOfferSchema = z.object({
  recipient_id: z.string().uuid(),
  amount: offerAmountSchema,
  terms: z.record(z.unknown()).optional(),
  note: z.string().trim().max(2000).optional(),
});

// SquadHub admin drives a business-side transition (signed proxy).
export const adminOffersWebhookSchema = z.object({
  external_id: z.string().min(1).max(200).optional(),
  op: z.enum(['counter', 'accept', 'decline', 'send']),
  offer_id: z.string().uuid().optional(),
  recipient_id: z.string().uuid().optional(),
  amount: offerAmountSchema.optional(),
  terms: z.record(z.unknown()).optional(),
  note: z.string().trim().max(2000).optional(),
  actor: z.object({ id: z.string().uuid().optional(), name: z.string().optional() }).optional(),
});

export type SubmitOfferInput = z.infer<typeof submitOfferSchema>;
export type TalentOfferRespondInput = z.infer<typeof talentOfferRespondSchema>;
export type BusinessCounterInput = z.infer<typeof businessCounterSchema>;
export type BusinessOfferActionInput = z.infer<typeof businessOfferActionSchema>;
