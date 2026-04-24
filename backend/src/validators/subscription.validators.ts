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
    published_at: z.string().datetime().optional(),
    expires_at: z.string().datetime().optional(),
  })
  .strict();

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
