import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

export async function listForAgency(
  agencyUserId: string,
  query: { status?: string; card_type?: string },
): Promise<Array<{
  id: string;
  status: string;
  responded_at: string | null;
  cancelled_at: string | null;
  card: any;
}>> {
  const cardType = (query as any).card_type as string | undefined;
  let q = supabaseAdmin
    .from('agency_card_recipients')
    .select('id, status, responded_at, cancelled_at, created_at, subscription_cards!inner(id, external_id, content, match_rules, status, published_at, expires_at, archived_at, card_type)')
    .eq('agency_user_id', agencyUserId)
    .is('subscription_cards.archived_at', null)
    .order('created_at', { ascending: false });

  if (cardType === 'subscription' || cardType === 'assignment' || cardType === 'hiring') {
    q = q.eq('subscription_cards.card_type', cardType);
  }

  if (query.status === 'pending') {
    q = q.eq('status', 'pending').is('cancelled_at', null).eq('subscription_cards.status', 'active');
  } else if (query.status === 'responded') {
    q = q.in('status', ['accepted', 'rejected']);
  } else if (query.status && query.status !== 'all') {
    q = q.eq('status', query.status);
  }

  const { data, error } = await q;
  if (error) {
    // table may not exist yet before migration runs — return empty
    if ((error as any).code === '42P01' || String((error as any).message).includes('does not exist')) return [];
    throw new AppError(500, error.message);
  }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    status: r.status,
    responded_at: r.responded_at,
    cancelled_at: r.cancelled_at,
    card: r.subscription_cards,
  }));
}

export async function getUnreadCountAgency(agencyUserId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('agency_card_recipients')
    .select('id, subscription_cards!inner(status, archived_at)', { count: 'exact', head: true })
    .eq('agency_user_id', agencyUserId)
    .eq('status', 'pending')
    .is('cancelled_at', null)
    .eq('subscription_cards.status', 'active')
    .is('subscription_cards.archived_at', null);
  if (error) {
    if ((error as any).code === '42P01') return 0;
    throw new AppError(500, error.message);
  }
  return count ?? 0;
}

/** Accept / decline a requirement card (mirrors talent respond). */
export async function respondCard(
  agencyUserId: string,
  recipientId: string,
  action: 'accept' | 'reject',
): Promise<{ id: string; status: string; responded_at: string }> {
  const newStatus = action === 'accept' ? 'accepted' : 'rejected';
  const respondedAt = new Date().toISOString();

  // Block responses to a card that's no longer live.
  const { data: cardRow } = await supabaseAdmin
    .from('agency_card_recipients')
    .select('subscription_cards!inner(status)')
    .eq('id', recipientId)
    .eq('agency_user_id', agencyUserId)
    .maybeSingle();
  if (cardRow && (cardRow as any).subscription_cards?.status !== 'active') {
    throw new AppError(409, 'This offer is no longer available');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('agency_card_recipients')
    .update({ status: newStatus, responded_at: respondedAt })
    .eq('id', recipientId)
    .eq('agency_user_id', agencyUserId)
    .eq('status', 'pending')
    .is('cancelled_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw new AppError(500, error.message);
  if (!updated) {
    const { data: existing } = await supabaseAdmin
      .from('agency_card_recipients')
      .select('id, status, cancelled_at')
      .eq('id', recipientId)
      .eq('agency_user_id', agencyUserId)
      .maybeSingle();
    if (!existing) throw new AppError(404, 'Card not found');
    if ((existing as any).cancelled_at) throw new AppError(409, 'This offer has been cancelled');
    throw new AppError(409, 'Already responded to this card');
  }

  return { id: updated.id as string, status: newStatus, responded_at: respondedAt };
}
