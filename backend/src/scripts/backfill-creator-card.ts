/** Run after deploying creator matching:
 * npx tsx src/scripts/backfill-creator-card.ts --card <Profiles card UUID>
 * Add --apply after reviewing the dry-run recipient count. No notifications sent.
 */
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { creatorMatchRules, isCreatorCard } from '../lib/creator-matching.js';
import { findMatchingTalents } from '../services/subscription-matcher.service.js';

async function main() {
  const { values } = parseArgs({ options: { card: { type: 'string' }, apply: { type: 'boolean', default: false } } });
  if (!values.card || !/^[0-9a-f-]{36}$/i.test(values.card)) throw new Error('Supply --card <Profiles card UUID>');
  const target = JSON.parse(readFileSync(resolve(__dirname, '../../../supabase/production-target.json'), 'utf8'));
  if (new URL(env.SUPABASE_URL).hostname !== `${target.project_ref}.supabase.co`) {
    throw new Error('Supabase URL does not match the checked-in production target');
  }
  const { data: card, error } = await supabaseAdmin.from('subscription_cards')
    .select('id, content, match_rules, card_type, distribution, status, archived_at')
    .eq('id', values.card).single();
  if (error) throw error;
  if (card.status !== 'active' || card.archived_at || card.distribution === 'manual'
      || card.card_type === 'hiring' || !isCreatorCard(card.match_rules)) {
    throw new Error('Expected an active, automatically distributed creator subscription or assignment');
  }
  const rules = creatorMatchRules(card.match_rules, card.content);
  const talents = await findMatchingTalents(rules, { cardType: card.card_type });
  const { data: recipients, error: recipientError } = await supabaseAdmin.from('subscription_card_recipients')
    .select('talent_user_id').eq('card_id', card.id);
  if (recipientError) throw recipientError;
  const existing = new Set((recipients ?? []).map((r) => r.talent_user_id));
  const pending = talents.filter((id) => !existing.has(id));
  console.info({ project: target.project_ref, card: card.id, matched: talents.length, missingRecipients: pending.length, apply: values.apply });
  if (values.apply && pending.length) {
    const { error: insertError } = await supabaseAdmin.from('subscription_card_recipients').upsert(
      pending.map((talent_user_id) => ({ card_id: card.id, talent_user_id, status: 'pending' })),
      { onConflict: 'card_id,talent_user_id', ignoreDuplicates: true },
    );
    if (insertError) throw insertError;
    const { count, error: verifyError } = await supabaseAdmin.from('subscription_card_recipients')
      .select('id', { count: 'exact', head: true }).eq('card_id', card.id).in('talent_user_id', pending);
    if (verifyError) throw verifyError;
    if (count !== pending.length) throw new Error('Recipient verification failed');
    console.info({ verifiedRecipients: count });
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'Creator backfill failed'); process.exitCode = 1; });
