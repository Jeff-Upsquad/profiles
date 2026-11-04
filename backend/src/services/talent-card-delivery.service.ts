import { supabaseAdmin } from '../config/supabase.js';
import { creatorMatchRules } from '../lib/creator-matching.js';
import { findMatchingTalents, type MatchRules } from './subscription-matcher.service.js';

type Card = {
  id: string; content: Record<string, unknown>; match_rules: MatchRules;
  card_type: 'subscription' | 'assignment' | 'hiring'; distribution: string | null;
  status: string; archived_at: string | null; expires_at: string | null;
  business_user_id?: string | null; business_email?: string | null;
};
export interface DeliveryOptions { talentUserId?: string; apply?: boolean; }
export interface DeliveryResult { checked: number; missing: number; inserted: number; failed: number; }
const PAGE_SIZE = 1000;

function live(card: Card): boolean {
  return card.status === 'active' && !card.archived_at && card.distribution !== 'manual'
    && (!card.expires_at || Date.parse(card.expires_at) > Date.now());
}

async function loadCards(): Promise<Card[]> {
  const rows: Card[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin.from('subscription_cards')
      .select('id, content, match_rules, card_type, distribution, status, archived_at, expires_at, business_user_id, business_email')
      .eq('status', 'active').is('archived_at', null).order('id').range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []) as Card[]);
    if ((data ?? []).length < PAGE_SIZE) return rows;
  }
}

async function recipientHistory(cardId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin.from('subscription_card_recipients')
      .select('id, talent_user_id').eq('card_id', cardId).order('id').range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data ?? []) ids.add(row.talent_user_id);
    if ((data ?? []).length < PAGE_SIZE) return ids;
  }
}

/** Shared matcher for first delivery and catch-up. Automatic repair only adds
 * never-delivered pairs: cancelled/declined/accepted rows remain history.
 * No notifications are sent by this catch-up operation. */
export async function reconcileTalentCardDeliveries(options: DeliveryOptions = {}): Promise<DeliveryResult> {
  const result: DeliveryResult = { checked: 0, missing: 0, inserted: 0, failed: 0 };
  let categories: Set<string> | undefined;
  if (options.talentUserId) {
    const { data, error } = await supabaseAdmin.from('talent_profiles')
      .select('category_id, talent_users!inner(is_active, suspended, blacklisted)')
      .eq('talent_user_id', options.talentUserId).eq('status', 'approved')
      .eq('is_active', true).is('deleted_at', null).eq('talent_users.is_active', true)
      .eq('talent_users.suspended', false).eq('talent_users.blacklisted', false);
    if (error) throw error;
    categories = new Set((data ?? []).map((p) => p.category_id as string));
    if (!categories.size) return result;
  }
  const cards = (await loadCards()).filter((c) => live(c)
    && (options.talentUserId || c.business_user_id || c.business_email)
    && (!categories || c.match_rules?.category_ids?.some((id) => categories!.has(id))));
  for (const initial of cards) {
    try {
      result.checked++;
      let card = initial;
      let matched = await findMatchingTalents(creatorMatchRules(card.match_rules ?? {}, card.content),
        { cardType: card.card_type, talentUserId: options.talentUserId });
      const history = await recipientHistory(card.id);
      let missing = matched.filter((id) => !history.has(id));
      result.missing += missing.length;
      if (!options.apply || !missing.length) continue;
      // Re-read before writing: a recall, manual switch or rule edit may have
      // happened while the sweep was checking earlier cards.
      const { data: current, error } = await supabaseAdmin.from('subscription_cards')
        .select('id, content, match_rules, card_type, distribution, status, archived_at, expires_at')
        .eq('id', card.id).maybeSingle();
      if (error) throw error;
      if (!current || !live(current as Card)) continue;
      card = current as Card;
      matched = await findMatchingTalents(creatorMatchRules(card.match_rules ?? {}, card.content),
        { cardType: card.card_type, talentUserId: options.talentUserId });
      missing = missing.filter((id) => matched.includes(id));
      // Partial unique index prevents duplicate active recipients. A concurrent
      // webhook can win some inserts; reload history and retry the others.
      for (let attempt = 0; attempt < 3 && missing.length; attempt++) {
        const existing = await recipientHistory(card.id);
        missing = missing.filter((id) => !existing.has(id));
        if (!missing.length) break;
        const batch = missing.slice(0, PAGE_SIZE);
        const { error: insertError, count } = await supabaseAdmin.from('subscription_card_recipients')
          .insert(batch.map((talent_user_id) => ({ card_id: card.id, talent_user_id, status: 'pending' })), { count: 'exact' });
        if (insertError) {
          if (insertError.code !== '23505') throw insertError;
        } else {
          result.inserted += count ?? batch.length;
          missing = missing.slice(batch.length);
          attempt--; // Successful batches do not consume race retries.
        }
      }
      if (missing.length) throw new Error('Recipient insert remained contested after retries');
    } catch (error) {
      result.failed++;
      console.error('[talent-card-delivery] card catch-up failed', { cardId: initial.id, code: (error as { code?: string }).code });
    }
  }
  return result;
}

const pending = new Map<string, Promise<void>>();
export function queueTalentCardCatchup(talentUserId: string): void {
  if (pending.has(talentUserId)) return;
  const run = reconcileTalentCardDeliveries({ talentUserId, apply: true })
    .then((result) => { if (result.inserted || result.failed) console.info('[talent-card-delivery] talent catch-up', result); })
    .catch((error) => console.error('[talent-card-delivery] talent catch-up failed', { code: error?.code }))
    .finally(() => pending.delete(talentUserId));
  pending.set(talentUserId, run);
}

export function startTalentCardDeliverySweeper(): NodeJS.Timeout {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await reconcileTalentCardDeliveries({ apply: true });
      if (result.inserted || result.failed) console.info('[talent-card-delivery] sweep', result);
    } catch (error) {
      console.error('[talent-card-delivery] sweep failed', { code: (error as { code?: string }).code });
    } finally { running = false; }
  };
  // Catch old gaps after deployment, then recover missed events every 15 min.
  setTimeout(() => void tick(), 60_000).unref();
  const timer = setInterval(() => void tick(), 15 * 60_000);
  timer.unref();
  return timer;
}
