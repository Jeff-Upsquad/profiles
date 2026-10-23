import { supabaseAdmin } from '../config/supabase.js';
import { hubDoubtsConnected, hubJson } from './squadhub-bot.service.js';
import { phoneMatchSuffix } from '../lib/phone.js';
import type { NeedsYouReason, StageTimerState } from '../lib/stage-timers.js';

/** Any Squadbot asking for human help on this applicant's app or WhatsApp chat. */
export async function onboardingNeedsYou(
  talents: Array<{ id: string; phone?: string | null; stage_timer_state?: StageTimerState | null }>,
): Promise<Map<string, NeedsYouReason[]>> {
  const result = new Map<string, NeedsYouReason[]>();
  if (!talents.length) return result;
  // Disconnection is not evidence that a previous human-help request was cleared.
  if (!hubDoubtsConnected()) {
    for (const t of talents) {
      if (t.stage_timer_state?.needs_you?.length) result.set(t.id, t.stage_timer_state.needs_you);
      else if (t.stage_timer_state?.rc_needs_you_paused) result.set(t.id, [{
        bot_name: 'Squadbot', reason: 'Waiting to verify that Needs You has been cleared.', since: null,
      }]);
    }
    return result;
  }
  const ids = new Set(talents.map(t => t.id));
  const phones = new Map(talents.flatMap(t => {
    const suffix = phoneMatchSuffix(t.phone);
    return suffix?.length === 10 ? [[suffix, t.id] as const] : [];
  }));
  const conversations: Array<{ id: string; talentId: string }> = [];
  // Include phone-only chats started before signup, and every bot's conversation.
  for (let offset = 0; ; offset += 500) {
    const page = await supabaseAdmin.from('squad_bot_conversations')
      .select('id,talent_user_id,phone').order('id').range(offset, offset + 499);
    if (page.error) throw new Error(page.error.message);
    for (const c of page.data ?? []) {
      const talentId = c.talent_user_id ?? phones.get(phoneMatchSuffix(c.phone) ?? '');
      if (talentId && ids.has(talentId)) conversations.push({ id: c.id, talentId });
    }
    if (!page.data || page.data.length < 500) break;
  }
  for (let offset = 0; offset < conversations.length; offset += 200) {
    const batch = conversations.slice(offset, offset + 200);
    const byConversation = new Map(batch.map(c => [c.id, c.talentId]));
    const attention = await hubJson<Array<{ external_id: string; reasons: NeedsYouReason[] }>>(
      'conversations/attention', 'POST', { app: 'SquadHire', external_ids: batch.map(c => c.id) },
    );
    for (const a of attention) {
      const id = byConversation.get(a.external_id);
      if (id && a.reasons.length) result.set(id, [...(result.get(id) ?? []), ...a.reasons]);
    }
  }
  return result;
}

/** Admin still shows the last verified reason if the connected service is unavailable. */
export async function adminOnboardingNeedsYou(talents: Parameters<typeof onboardingNeedsYou>[0]) {
  try { return await onboardingNeedsYou(talents); }
  catch (error) {
    console.error('[stage-timers] Needs You lookup failed:', error);
    return new Map(talents.filter(t => t.stage_timer_state?.needs_you?.length)
      .map(t => [t.id, t.stage_timer_state!.needs_you!]));
  }
}
