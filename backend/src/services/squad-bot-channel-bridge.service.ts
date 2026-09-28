// Bridge SquadHire's durable handoffs and SquadHub's bot question decisions.
// Multiple backend instances may poll; SquadHub's claim is the execution lock.
import { supabaseAdmin } from '../config/supabase.js';
import { claimHubDoubt, hubDoubtsConnected, pendingHubDoubts, reportHubDoubtOutcome } from './squadhub-bot.service.js';
import { getConversation, handBack, instructBot, publishHandoffToHub } from './squad-bot.service.js';

const INTERVAL_MS = 20_000;

async function syncUnpublishedHandoffs(): Promise<void> {
  const { data, error } = await supabaseAdmin.from('squad_bot_conversations')
    .select('id').eq('status', 'handoff').is('hub_doubt_id', null)
    .order('handoff_at').limit(50);
  if (error) throw error;
  for (const row of data ?? []) {
    try { await publishHandoffToHub(row.id); }
    catch (err) { console.error('[squad-bot] channel handoff retry failed:', row.id, (err as Error).message); }
  }
}

async function syncUnreportedOutcomes(): Promise<void> {
  const { data, error } = await supabaseAdmin.from('squad_bot_conversations')
    .select('id, hub_doubt_id, hub_execution_token, hub_execution_outcome, hub_execution_note')
    .not('hub_execution_outcome', 'is', null).limit(50);
  if (error) throw error;
  for (const row of data ?? []) {
    try {
      await reportHubDoubtOutcome(row.hub_doubt_id, row.hub_execution_token, row.hub_execution_outcome, row.hub_execution_note);
      await supabaseAdmin.from('squad_bot_conversations').update({ hub_execution_outcome: null, hub_execution_note: null })
        .eq('id', row.id).eq('hub_execution_token', row.hub_execution_token);
    } catch (err) { console.error('[squad-bot] outcome retry failed:', row.id, (err as Error).message); }
  }
}

async function executeInstruction(id: string, eventId: string): Promise<void> {
  // Only process SquadHire handoffs. Other connected apps use the same bot key.
  if (!eventId.startsWith('squadhire:handoff:')) return;
  const { data: local, error } = await supabaseAdmin.from('squad_bot_conversations')
    .select('id, status, handoff_at').eq('hub_doubt_id', id).maybeSingle();
  if (error) throw error;
  // A missing local chat still needs an outcome so it cannot be retried forever.
  const claimed = await claimHubDoubt(id);
  if (!claimed?.execution_token) return;
  const token = claimed.execution_token;
  let outcome: 'completed' | 'failed' = 'completed';
  let note = 'Squad Bot replied in the original SquadHire conversation.';
  try {
    if (local) {
      const { error: saveClaimError } = await supabaseAdmin.from('squad_bot_conversations')
        .update({ hub_execution_token: token }).eq('id', local.id).eq('hub_doubt_id', id);
      if (saveClaimError) throw saveClaimError;
    }
    if (!local || local.status !== 'handoff' ||
      `squadhire:handoff:${local.id}:${new Date(local.handoff_at).toISOString()}` !== eventId) {
      throw new Error('The original handoff is no longer active in SquadHire');
    }
    const conversation = await getConversation(local.id);
    if (conversation.messages.some((message: { sender: string; created_at: string }) =>
      ['staff', 'instruction'].includes(message.sender) && new Date(message.created_at) >= new Date(local.handoff_at))) {
      throw new Error('A teammate has already responded in SquadHire');
    }
    if (!claimed.instruction?.trim()) throw new Error('The saved instruction is empty');
    const actor = { id: claimed.resolved_by || '00000000-0000-0000-0000-000000000000', name: 'SquadHub teammate' };
    const result = await instructBot(local.id, actor, claimed.instruction);
    if (!result.message) throw new Error('Squad Bot could not complete the instruction');
    await handBack(local.id, actor);
  } catch (err) {
    outcome = 'failed';
    note = (err as Error).message.slice(0, 4000) || 'The action failed in SquadHire';
    console.error('[squad-bot] channel instruction failed:', id, note);
  }
  // Reporting failure must never relabel a successfully sent reply as failed.
  if (local) {
    const { error: saveError } = await supabaseAdmin.from('squad_bot_conversations')
      .update({ hub_execution_token: token, hub_execution_outcome: outcome, hub_execution_note: note })
      .eq('id', local.id).eq('hub_doubt_id', id);
    if (saveError) console.error('[squad-bot] could not save outcome for retry:', id, saveError.message);
  }
  await reportHubDoubtOutcome(id, token, outcome, note);
  if (local) await supabaseAdmin.from('squad_bot_conversations')
    .update({ hub_execution_outcome: null, hub_execution_note: null })
    .eq('id', local.id).eq('hub_execution_token', token);
}

async function syncInstructions(): Promise<void> {
  // Page while there are more instructions; a paused or out-of-scope job can
  // remain queued, so don't let its page block later decisions.
  for (let page = 0; page < 5; page++) {
    const doubts = await pendingHubDoubts(page);
    for (const doubt of doubts) {
      try { await executeInstruction(doubt.id, doubt.event_id); }
      catch (err) { console.error('[squad-bot] channel decision retry failed:', doubt.id, (err as Error).message); }
    }
    if (doubts.length < 100) break;
  }
}

export function startSquadBotChannelBridge(): NodeJS.Timeout | null {
  if (!hubDoubtsConnected()) return null;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await syncUnpublishedHandoffs(); await syncUnreportedOutcomes(); await syncInstructions(); }
    catch (err) { console.error('[squad-bot] channel bridge tick failed:', (err as Error).message); }
    finally { running = false; }
  };
  const handle = setInterval(tick, INTERVAL_MS);
  setTimeout(tick, 5_000);
  return handle;
}
