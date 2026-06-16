import { z } from 'zod';

/**
 * Inbound webhook payload from SquadHub. `content` and `match_rules` are
 * free-form objects — we persist them verbatim into JSONB columns, which lets
 * SquadHub evolve the shape without a Profiles migration. Unknown top-level
 * keys are stripped (Zod's default strip mode) so SquadHub can add fields
 * like `distribution` independently without breaking ingest.
 */
export const ingestSubscriptionCardSchema = z.object({
  external_id: z.string().min(1).max(200),
  content: z.record(z.unknown()).default({}),
  match_rules: z.record(z.unknown()).default({}),
  // Accept both the Z-suffix and +HH:MM offset forms of ISO-8601. Postgres
  // and the Supabase JS client hand back the offset form, which vanilla
  // `.datetime()` rejects. `offset: true` covers both.
  published_at: z.string().datetime({ offset: true }).optional(),
  expires_at: z.string().datetime({ offset: true }).optional(),
  // Propagated from SquadHub so Recall / Close on their side can hide
  // the card from talent dashboards. Omitted on first publish → stays
  // 'active' by default.
  status: z.enum(['active', 'assigned', 'archived']).optional(),
  // SquadHub's identifier for the client this card was created for. We
  // resolve it to a Profiles business_users row at ingest time so talent
  // accept/reject can populate that business's dashboard view. Optional
  // for backwards compat — cards without a resolvable email behave as before.
  business_email: z.string().email().toLowerCase().optional(),
  // SquadHub also passes the lead's phone, contact name, and company so we
  // can resolve a business_user by phone when the email isn't on file, and —
  // failing that — create a pending invitation that lets them sign in later.
  // All optional for backwards compat.
  business_phone: z.string().min(6).max(40).optional(),
  business_contact_name: z.string().min(1).max(200).optional(),
  business_company: z.string().min(1).max(200).optional(),
  // SquadHub's distribution mode. `broadcast` (default) = fan out to every
  // matching talent at ingest. `manual` ("soft publish") = card is delivered
  // for the business's own dashboard but talents only see it via a separate
  // /manual-assignments call. Defaulting to broadcast preserves prior
  // behaviour for any caller that hasn't started sending the field.
  distribution: z.enum(['broadcast', 'manual']).default('broadcast'),
  // Stamped by SquadHub when an admin recalled a card that already had
  // acceptances. Drives the "Recalled" tag on the business dashboard and
  // keeps such cards in the Open section instead of moving to Closed.
  // Absent on never-recalled cards. `null` is also accepted so SquadHub
  // can clear the flag if a recall is undone.
  recalled_at: z.string().datetime({ offset: true }).nullable().optional(),
  // Stamped by SquadHub when an admin explicitly archived a card from
  // its Archive tab. Stronger hide than `status='archived'`: this card
  // disappears from BOTH talent feeds (pending and responded) AND the
  // business dashboard. SquadHub sends `null` on republish to clear it.
  archived_at: z.string().datetime({ offset: true }).nullable().optional(),
  // True when SquadHub created this card as a child of another card
  // (parent_card_id IS NOT NULL on its side). Profiles hides secondaries
  // from the business dashboard list. Defaulted to false so callers that
  // haven't been updated yet keep behaving as before — once SquadHub starts
  // sending the flag explicitly, secondaries get filtered.
  is_secondary: z.boolean().default(false),
  // Shared id across the per-tier sibling cards SquadHub fanned out from one
  // multi-tier brief. The business dashboard collapses cards with the same
  // group_id into a single card with a tab per tier. Null/absent on
  // single-tier and legacy cards — those render as one card each, unchanged.
  group_id: z.string().uuid().nullable().optional(),
});

export const removeTalentFromCardSchema = z.object({
  talent_user_id: z.string().uuid(),
});

/**
 * Inbound notification from SquadHub when an admin hand-picks a talent for a
 * soft-published subscription card. We upsert the recipient row so the talent
 * sees the card in their subscriptions tab, same as if they'd been auto-
 * matched at publish time.
 *
 * `card_id` here is SquadHub's UUID — i.e. our `external_id`. `talent_id` is
 * a Profiles `talent_users.id`. Both are UUIDs but `card_id` is loosely
 * validated to keep parity with the ingest schema.
 */
export const manualAssignTalentSchema = z.object({
  type: z.literal('manual_assignment').optional(),
  card_id: z.string().min(1).max(200),
  talent_id: z.string().uuid(),
  assigned_at: z.string().datetime({ offset: true }).optional(),
});

/**
 * Inbound notification from SquadHub when an admin removes a previously-
 * assigned talent from a card. Delete the recipient row so the talent stops
 * seeing the card in their subscriptions tab. Idempotent — a removal for a
 * card+talent pair that's already gone returns `removed: 0`.
 */
export const removeAssignedTalentSchema = z.object({
  type: z.literal('manual_assignment_removal').optional(),
  card_id: z.string().min(1).max(200),
  talent_id: z.string().uuid(),
  removed_at: z.string().datetime({ offset: true }).optional(),
});

/**
 * Inbound notification from SquadHub when an admin auto-accepts a card on
 * behalf of a talent. Mirror the talent's row to status='accepted' and run
 * the same business-dashboard side effect as a real talent response.
 */
export const talentAcceptedWebhookSchema = z.object({
  type: z.literal('talent_accepted').optional(),
  card_id: z.string().min(1).max(200),
  talent_id: z.string().uuid(),
  accepted_at: z.string().datetime({ offset: true }).optional(),
});

export const externalIdParamSchema = z.object({
  externalId: z.string().min(1).max(200),
});

export const cardIdRecipientIdParamSchema = z.object({
  cardId: z.string().uuid(),
  recipientId: z.string().uuid(),
});

export const listSubscriptionsQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected', 'all']).default('pending'),
});

export const respondToSubscriptionSchema = z.object({
  action: z.enum(['accept', 'reject']),
});

export const recipientIdParamSchema = z.object({
  recipientId: z.string().uuid(),
});

export const selectRecipientSchema = z.object({
  recipient_id: z.string().uuid(),
});

export const cardSelectionWebhookSchema = z.object({
  type: z.literal('card_selection').optional(),
  card_id: z.string().min(1).max(200),
  talent_id: z.string().uuid().nullable().optional(),
  talent_ids: z.array(z.string().min(1)).optional(),
  selected_at: z.string().datetime({ offset: true }),
  card_status: z.enum(['assigned', 'active', 'archived']).optional(),
});

export const cardSelectionUndoWebhookSchema = z.object({
  type: z.literal('card_selection_undo').optional(),
  card_id: z.string().min(1).max(200),
  undone_at: z.string().datetime({ offset: true }).optional(),
});

// Fired by SquadHub when admin clicks "Finalize" on a selected card. Flips the
// talent's My Clients view for this card from "Selected (waiting admin
// approval)" to "Assigned (active)". Idempotent — re-firing just rewrites
// subscription_activated_at to the same value.
export const cardActivationWebhookSchema = z.object({
  type: z.literal('card_activation').optional(),
  card_id: z.string().min(1).max(200),
  activated_at: z.string().datetime({ offset: true }),
});

// Fired by SquadHub's "Broadcast to talents" after a reopen — wipe the prior
// round and re-fan-out to the full matching pool (a fresh ask to everyone).
export const cardFreshBroadcastWebhookSchema = z.object({
  type: z.literal('card_fresh_broadcast').optional(),
  card_id: z.string().min(1).max(200),
});

export type SelectRecipientInput = z.infer<typeof selectRecipientSchema>;
export type CardSelectionWebhookInput = z.infer<typeof cardSelectionWebhookSchema>;
export type CardSelectionUndoWebhookInput = z.infer<typeof cardSelectionUndoWebhookSchema>;
export type CardActivationWebhookInput = z.infer<typeof cardActivationWebhookSchema>;

export type IngestSubscriptionCardInput = z.infer<typeof ingestSubscriptionCardSchema>;
export type ListSubscriptionsQueryInput = z.infer<typeof listSubscriptionsQuerySchema>;
export type RespondToSubscriptionInput = z.infer<typeof respondToSubscriptionSchema>;
export type RemoveTalentFromCardInput = z.infer<typeof removeTalentFromCardSchema>;
export type ManualAssignTalentInput = z.infer<typeof manualAssignTalentSchema>;
export type RemoveAssignedTalentInput = z.infer<typeof removeAssignedTalentSchema>;
