import { z } from 'zod';

/**
 * Inbound webhook payload from SquadHub. `content` and `match_rules` are
 * free-form objects — we persist them verbatim into JSONB columns, which lets
 * SquadHub evolve the shape without a Profiles migration. Unknown top-level
 * keys are stripped.
 */
export const ingestSubscriptionCardSchema = z
  .object({
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
    status: z.enum(['active', 'archived']).optional(),
    // SquadHub's identifier for the client this card was created for. We
    // resolve it to a Profiles business_users row at ingest time so talent
    // accept/reject can populate that business's dashboard view. Optional
    // for backwards compat — cards without a resolvable email behave as before.
    business_email: z.string().email().toLowerCase().optional(),
  })
  .strict();

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

export const externalIdParamSchema = z.object({
  externalId: z.string().min(1).max(200),
});

export const cardIdRecipientIdParamSchema = z.object({
  cardId: z.string().uuid(),
  recipientId: z.string().uuid(),
});

export const listSubscriptionsQuerySchema = z.object({
  status: z.enum(['pending', 'responded', 'all']).default('pending'),
});

export const respondToSubscriptionSchema = z.object({
  action: z.enum(['accept', 'reject']),
});

export const recipientIdParamSchema = z.object({
  recipientId: z.string().uuid(),
});

export type IngestSubscriptionCardInput = z.infer<typeof ingestSubscriptionCardSchema>;
export type ListSubscriptionsQueryInput = z.infer<typeof listSubscriptionsQuerySchema>;
export type RespondToSubscriptionInput = z.infer<typeof respondToSubscriptionSchema>;
export type RemoveTalentFromCardInput = z.infer<typeof removeTalentFromCardSchema>;
export type ManualAssignTalentInput = z.infer<typeof manualAssignTalentSchema>;
