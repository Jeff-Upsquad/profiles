import { supabaseAdmin } from '../config/supabase.js';
import { hubDoubtsConnected, hubJson } from './squadhub-bot.service.js';
import { syncToInbox } from './squad-bots-inbox.service.js';
import type { ConversationRow } from './squad-bot.service.js';

type Actor = { id: string | null; name: string };
type State = { taken_over: boolean; conversation_id: string };
const path = (id: string) => `conversations/state?app=SquadHire&external_id=${encodeURIComponent(id)}`;

/** No cached ownership: both inboxes must stop an in-flight answer immediately. */
export async function currentChatBotSwitch(conv: ConversationRow): Promise<boolean> {
  if (!hubDoubtsConnected()) return conv.status !== 'handoff';
  let state: State;
  try { state = await hubJson<State>(path(conv.id)); }
  catch (error) {
    if (!/Conversation not found/.test(String(error))) throw error;
    // Seed legacy handoffs once; an existing shared switch always wins afterwards.
    await syncToInbox(conv.id);
    await setChatBotSwitch(conv, conv.status !== 'handoff', { id: null, name: 'Team' });
    state = await hubJson<State>(path(conv.id));
  }
  const enabled = !state.taken_over;
  // Compatibility for old admin/support screens. This mirror is never authoritative.
  if (enabled !== (conv.status !== 'handoff')) {
    const { error } = await supabaseAdmin.from('squad_bot_conversations').update(enabled
      ? { status: 'bot', handoff_reason: null, handoff_summary: null, handoff_at: null }
      : { status: 'handoff' }).eq('id', conv.id);
    if (error) throw error;
    conv.status = enabled ? 'bot' : 'handoff';
  }
  return enabled;
}

export async function setChatBotSwitch(conv: ConversationRow, enabled: boolean, actor: Actor) {
  if (hubDoubtsConnected()) {
    await hubJson('conversations/control', 'POST', {
      app: 'SquadHire', external_id: conv.id, participant_id: conv.id,
      participant_name: conv.contact_name || 'Candidate', title: conv.crm_pipeline_name || 'In-app chat', enabled, actor,
    });
  }
  const { error } = await supabaseAdmin.from('squad_bot_conversations').update(enabled
    ? { status: 'bot', handoff_reason: null, handoff_summary: null, handoff_at: null }
    : { status: 'handoff' }).eq('id', conv.id);
  if (error) throw error;
  conv.status = enabled ? 'bot' : 'handoff';
  return { enabled };
}
