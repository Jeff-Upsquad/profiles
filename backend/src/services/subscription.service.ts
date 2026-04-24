import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { findMatchingTalents } from './subscription-matcher.service.js';
import { deliverCallback } from './squadhub-callback.service.js';
import type {
  IngestSubscriptionCardInput,
  ListSubscriptionsQueryInput,
  RespondToSubscriptionInput,
} from '../validators/subscription.validators.js';

// ─── Ingest (webhook from SquadHub) ────────────────────────────────────────

export interface IngestResult {
  id: string;
  external_id: string;
  inserted: boolean;
  recipient_count: number;
}

export async function ingestCard(input: IngestSubscriptionCardInput): Promise<IngestResult> {
  const row = {
    external_id: input.external_id,
    content: input.content,
    match_rules: input.match_rules,
    published_at: input.published_at ?? new Date().toISOString(),
    expires_at: input.expires_at ?? null,
  };

  // Upsert the card by external_id for idempotency.
  const { data: existing } = await supabaseAdmin
    .from('subscription_cards')
    .select('id')
    .eq('external_id', input.external_id)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from('subscription_cards')
      .update({
        content: row.content,
        match_rules: row.match_rules,
        published_at: row.published_at,
        expires_at: row.expires_at,
      })
      .eq('id', existing.id);
    if (error) throw new AppError(500, error.message);

    return {
      id: existing.id,
      external_id: input.external_id,
      inserted: false,
      recipient_count: 0,
    };
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('subscription_cards')
    .insert(row)
    .select('id')
    .single();
  if (insErr || !inserted) throw new AppError(500, insErr?.message ?? 'Failed to insert card');

  // Fan out: find matching talents and batch-insert recipient rows.
  const talentIds = await findMatchingTalents(input.match_rules ?? {});

  let recipientCount = 0;
  if (talentIds.length > 0) {
    const recipients = talentIds.map((talent_user_id) => ({
      card_id: inserted.id,
      talent_user_id,
      status: 'pending' as const,
    }));

    const { error: recErr, count } = await supabaseAdmin
      .from('subscription_card_recipients')
      .insert(recipients, { count: 'exact' });
    if (recErr) {
      console.error('[subscription] failed to insert recipients', recErr);
      // Don't fail the whole ingest — the card exists and the next retry/manual
      // fix can backfill. Log loudly and move on.
    } else {
      recipientCount = count ?? recipients.length;
    }
  }

  return {
    id: inserted.id,
    external_id: input.external_id,
    inserted: true,
    recipient_count: recipientCount,
  };
}

// ─── Talent-facing queries ─────────────────────────────────────────────────

interface RecipientRow {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  responded_at: string | null;
  created_at: string;
  subscription_cards: {
    id: string;
    external_id: string;
    content: Record<string, unknown>;
    status: 'active' | 'archived';
    published_at: string;
    expires_at: string | null;
  } | null;
}

export async function listForTalent(
  talentUserId: string,
  query: ListSubscriptionsQueryInput
): Promise<Array<{
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  responded_at: string | null;
  card: RecipientRow['subscription_cards'];
}>> {
  let q = supabaseAdmin
    .from('subscription_card_recipients')
    .select(
      'id, status, responded_at, created_at, subscription_cards!inner(id, external_id, content, status, published_at, expires_at)'
    )
    .eq('talent_user_id', talentUserId)
    .eq('subscription_cards.status', 'active')
    .order('created_at', { ascending: false });

  if (query.status === 'pending') {
    q = q.eq('status', 'pending');
  } else if (query.status === 'responded') {
    q = q.in('status', ['accepted', 'rejected']);
  }

  const { data, error } = await q;
  if (error) throw new AppError(500, error.message);

  return (data ?? []).map((r: any) => ({
    id: r.id,
    status: r.status,
    responded_at: r.responded_at,
    card: r.subscription_cards,
  }));
}

export async function getUnreadCount(talentUserId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, subscription_cards!inner(status)', { count: 'exact', head: true })
    .eq('talent_user_id', talentUserId)
    .eq('status', 'pending')
    .eq('subscription_cards.status', 'active');

  if (error) throw new AppError(500, error.message);
  return count ?? 0;
}

export async function respond(
  talentUserId: string,
  recipientId: string,
  input: RespondToSubscriptionInput
) {
  const newStatus = input.action === 'accept' ? 'accepted' : 'rejected';
  const respondedAt = new Date().toISOString();

  // The `status = 'pending'` guard prevents double-response races.
  const { data: updated, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .update({ status: newStatus, responded_at: respondedAt })
    .eq('id', recipientId)
    .eq('talent_user_id', talentUserId)
    .eq('status', 'pending')
    .select('id, talent_user_id, subscription_cards!inner(external_id)')
    .maybeSingle();

  if (error) throw new AppError(500, error.message);
  if (!updated) {
    // Either not found (or not owned), or already responded. Distinguish:
    const { data: existing } = await supabaseAdmin
      .from('subscription_card_recipients')
      .select('id, status')
      .eq('id', recipientId)
      .eq('talent_user_id', talentUserId)
      .maybeSingle();
    if (!existing) throw new AppError(404, 'Subscription not found');
    throw new AppError(409, 'Already responded to this subscription');
  }

  const externalId = (updated as any).subscription_cards?.external_id as string | undefined;

  // Fire-and-forget callback. Never block or fail the user's response on this.
  if (externalId) {
    deliverCallback({
      external_id: externalId,
      recipient_id: updated.id,
      talent_user_id: updated.talent_user_id,
      action: input.action,
      responded_at: respondedAt,
    }).catch((err) => {
      console.error('[subscription] deliverCallback threw unexpectedly', err);
    });
  }

  return {
    id: updated.id,
    status: newStatus,
    responded_at: respondedAt,
  };
}
